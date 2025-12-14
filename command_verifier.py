import re
import logging
from typing import Tuple, List, Set

logger = logging.getLogger(__name__)

class CommandVerifier:
    """Verify that kubectl commands are safe to execute"""
    
    # Read-only kubectl verbs that are safe to execute
    READ_ONLY_VERBS: Set[str] = {
        'get', 'describe', 'logs', 'explain', 'top', 'auth', 'api-versions', 
        'cluster-info', 'version', 'config', 'view', 'help'
    }
    
    # Potentially dangerous patterns to block
    UNSAFE_PATTERNS: List[str] = [
        # Command injection patterns
        r'\|\s*(grep|awk|sed|xargs|rm|mv|cp|sh|bash|zsh|fish|python|perl|ruby|php)',
        r';\s*(rm|mv|cp|sh|bash|zsh|fish|python|perl|ruby|php)',
        r'&\s*(rm|mv|cp|sh|bash|zsh|fish|python|perl|ruby|php)',
        r'&&\s*(rm|mv|cp|sh|bash|zsh|fish|python|perl|ruby|php)',
        r'\|\|\s*(rm|mv|cp|sh|bash|zsh|fish|python|perl|ruby|php)',
        
        # File operations (block dangerous redirections)
        r'\s>\s+(?!/dev/null\b)',  # Block output redirection except to /dev/null
        r'\s>>\s+',               # Block all append redirection
        r'\s<\s+(?!/dev/)',       # Block input redirection except from /dev/*
        r'\s2>\s+',               # Block stderr redirection
        r'\s1>\s+',               # Block stdout redirection
        
        # Command substitution
        r'\$\(',
        r'`.*`',
        
        # Environment variables that could be dangerous
        r'\$HOME',
        r'\$PATH',
        r'\$SHELL',
        
        # Direct file system access
        r'/etc/',
        r'/var/',
        r'/usr/',
        r'/bin/',
        r'/sbin/',
        r'/tmp/',
        r'~/',
        
        # Network operations
        r'curl',
        r'wget',
        r'nc',
        r'netcat',
        r'telnet',
        r'ssh',
        r'scp',
        r'rsync',
        
        # Process control
        r'kill',
        r'ps',
        r'pkill',
        r'killall',
        
        # Package management
        r'apt',
        r'yum',
        r'dnf',
        r'pacman',
        r'brew',
        
        # Shell features
        r'\*\*',
        r'\?\(',
        r'\$\{',
        r'<<',
        r'<<<'
    ]
    
    # Explicitly allowed patterns for common safe use cases
    ALLOWED_PATTERNS: List[str] = [
        r'<[^>]+>',  # Allow placeholders like <pod-name>, <deployment-name>, etc.
        r'>\s*/dev/null',  # Allow redirection to /dev/null
        r'</dev/',     # Allow input from /dev/* devices
    ]
    
    # Safe flags and options for read-only commands
    SAFE_FLAGS: Set[str] = {
        '-n', '--namespace',
        '-o', '--output',
        '-w', '--watch',
        '--watch-only',
        '-l', '--labels',
        '-f', '--field-selector',
        '-A', '--all-namespaces',
        '-s', '--show-labels',
        '--show-managed-fields',
        '--sort-by',
        '--selector',
        '--field-selector',
        '--server-side',
        '--chunk-size',
        '-v', '--v',
        '--vmodule',
        '--log-flush-frequency',
        '--log-backtrace-at',
        '--log-dir',
        '--logtostderr',
        '--alsologtostderr',
        '--log-file',
        '--log-file-max-size',
        '--skip-headers',
        '--skip-log-headers',
        '--one-output',
        '--log-json',
        '--short',  # Added for kubectl version --short
        '--client',  # For kubectl version --client
        '--server'   # For kubectl version --server
    }
    
    @classmethod
    def has_placeholders(cls, command: str) -> Tuple[bool, str]:
        """
        Check if a command contains placeholder values like <pod-name>, <namespace-name>, etc.
        
        Args:
            command: The kubectl command to check
            
        Returns:
            Tuple of (has_placeholders: bool, reason: str)
        """
        try:
            # Common placeholder patterns
            placeholder_patterns = [
                r'<[^>]+>',  # Anything in angle brackets like <pod-name>
                r'\{[^}]+\}',  # Anything in curly braces like {pod-name}
                r'\[[^\]]+\]',  # Anything in square brackets like [pod-name]
                r'pod-name',  # Literal "pod-name"
                r'namespace-name',  # Literal "namespace-name"
                r'service-name',  # Literal "service-name"
                r'deployment-name',  # Literal "deployment-name"
                r'resource-name',  # Literal "resource-name"
            ]
            
            for pattern in placeholder_patterns:
                if re.search(pattern, command, re.IGNORECASE):
                    return True, f"Command contains placeholder pattern: {pattern}"
            
            return False, "No placeholders found"
            
        except Exception as e:
            logger.error(f"Error checking placeholders in command '{command}': {str(e)}")
            return False, f"Error checking placeholders: {str(e)}"
    
    @classmethod
    def is_safe_command(cls, command: str) -> Tuple[bool, str]:
        """
        Check if a kubectl command is safe to execute
        
        Args:
            command: The kubectl command to verify
            
        Returns:
            Tuple of (is_safe: bool, reason: str)
        """
        try:
            # Basic validation
            if not command or not command.strip():
                return False, "Empty command"
            
            command = command.strip()
            
            # Must start with kubectl
            if not command.startswith('kubectl'):
                return False, "Command must start with 'kubectl'"
            
            # Split command into parts for analysis
            parts = command.split()
            if len(parts) < 2:
                return False, "Incomplete kubectl command"
            
            # Extract the kubectl verb
            verb = parts[1]
            
            # Check if verb is read-only
            if verb not in cls.READ_ONLY_VERBS:
                return False, f"Command verb '{verb}' is not read-only. Safe verbs are: {', '.join(sorted(cls.READ_ONLY_VERBS))}"
            
            # Check for unsafe patterns, but first check for allowed patterns
            for pattern in cls.UNSAFE_PATTERNS:
                if re.search(pattern, command, re.IGNORECASE):
                    # Check if this matches any allowed pattern
                    is_allowed = False
                    for allowed_pattern in cls.ALLOWED_PATTERNS:
                        if re.search(allowed_pattern, command):
                            is_allowed = True
                            break
                    
                    if not is_allowed:
                        return False, f"Command contains potentially dangerous pattern: {pattern}"
            
            # Validate flags and options (if any)
            if len(parts) > 2:
                for i, part in enumerate(parts[2:], 2):
                    # Skip resource names and values
                    if part.startswith('-'):
                        # Remove any values attached to flags (like -n=default)
                        flag = part.split('=')[0]
                        if flag not in cls.SAFE_FLAGS:
                            return False, f"Unsafe flag or option: {flag}"
            
            # Special checks for specific commands
            if verb == 'logs':
                # logs command should have a pod name
                if len(parts) < 3 or not any(not p.startswith('-') for p in parts[2:]):
                    return False, "logs command requires a pod name"
            
            elif verb == 'get':
                # get command should have a resource type
                if len(parts) < 3 or not any(not p.startswith('-') for p in parts[2:]):
                    return False, "get command requires a resource type"
            
            elif verb == 'describe':
                # describe command should have a resource type and name
                if len(parts) < 3 or not any(not p.startswith('-') for p in parts[2:]):
                    return False, "describe command requires a resource type and name"
            
            logger.info(f"Command verified as safe: {command}")
            return True, "Command is safe"
            
        except Exception as e:
            logger.error(f"Error verifying command '{command}': {str(e)}")
            return False, f"Error verifying command: {str(e)}"
    
    @classmethod
    def get_safe_commands_info(cls) -> dict:
        """
        Get information about safe commands and flags for user reference
        
        Returns:
            Dictionary with safe commands information
        """
        return {
            "safe_verbs": sorted(list(cls.READ_ONLY_VERBS)),
            "safe_flags": sorted(list(cls.SAFE_FLAGS)),
            "description": "Only read-only kubectl commands are allowed for safety",
            "examples": [
                "kubectl get pods",
                "kubectl get pods -n default",
                "kubectl describe pod my-pod",
                "kubectl logs my-pod",
                "kubectl get deployments -o wide",
                "kubectl cluster-info",
                "kubectl get nodes",
                "kubectl get services --all-namespaces"
            ]
        }
    
    @classmethod
    def sanitize_command(cls, command: str) -> str:
        """
        Basic command sanitization
        
        Args:
            command: Raw command string
            
        Returns:
            Sanitized command string
        """
        # Remove extra whitespace
        command = ' '.join(command.split())
        
        # Remove potentially dangerous characters (basic sanitization)
        command = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', command)
        
        return command.strip()