import subprocess
import json
import logging
import re
import os
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

class K8sClient:
    """Kubernetes client wrapper using kubectl commands with default kubeconfig"""
    
    def __init__(self, kubeconfig_path: str = None):
        """
        Initialize K8s client
        Args:
            kubeconfig_path: Path to kubeconfig file (defaults to ~/.kube/config)
        """
        self.kubeconfig_path = kubeconfig_path or os.path.expanduser("~/.kube/config")
        self._validate_kubectl_access()
    
    def _get_kubectl_command(self, command: List[str]) -> List[str]:
        """
        Build kubectl command with kubeconfig flag if needed
        Args:
            command: kubectl command as list
        Returns:
            Full kubectl command with kubeconfig flag
        """
        full_command = ['kubectl']
        
        # Add kubeconfig flag if custom path is specified
        if self.kubeconfig_path != os.path.expanduser("~/.kube/config"):
            full_command.extend(['--kubeconfig', self.kubeconfig_path])
        
        full_command.extend(command)
        return full_command
    
    def _validate_kubectl_access(self):
        """Validate kubectl is accessible and can connect to cluster"""
        try:
            result = subprocess.run(
                ['kubectl', 'cluster-info'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                logger.warning(f"kubectl cluster-info failed: {result.stderr}")
            else:
                logger.info("kubectl access validated successfully")
        except subprocess.TimeoutExpired:
            logger.error("kubectl cluster-info timed out")
        except FileNotFoundError:
            logger.error("kubectl not found in PATH")
    
    def _run_kubectl_command(self, command: List[str], timeout: int = 30) -> Dict[str, Any]:
        """
        Execute kubectl command safely
        Args:
            command: kubectl command as list
            timeout: Command timeout in seconds
        Returns:
            Dictionary with success, data, error, etc.
        """
        try:
            full_command = self._get_kubectl_command(command)
            
            logger.info(f"Executing: {' '.join(full_command)}")
            
            result = subprocess.run(
                full_command,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            # Check if kubectl itself is not available
            if result.returncode != 0 and "not found" in result.stderr.lower():
                return {
                    'success': False,
                    'error': 'kubectl not found - please install kubectl or ensure it\'s in PATH',
                    'stdout': '',
                    'stderr': result.stderr,
                    'returncode': result.returncode,
                    'command': ' '.join(full_command),
                    'timestamp': datetime.now().isoformat(),
                    'kubectl_available': False
                }
            
            # Check for cluster connection issues
            if result.returncode != 0 and any(phrase in result.stderr.lower() for phrase in [
                'unable to connect', 'connection refused', 'no configuration', 'invalid configuration'
            ]):
                return {
                    'success': False,
                    'error': f'Cluster connection error: {result.stderr.strip()}',
                    'stdout': '',
                    'stderr': result.stderr,
                    'returncode': result.returncode,
                    'command': ' '.join(full_command),
                    'timestamp': datetime.now().isoformat(),
                    'cluster_accessible': False
                }
            
            return {
                'success': result.returncode == 0,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode,
                'command': ' '.join(full_command),
                'timestamp': datetime.now().isoformat(),
                'kubectl_available': True,
                'cluster_accessible': True
            }
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': f"Command timed out after {timeout} seconds",
                'stdout': '',
                'stderr': 'Timeout',
                'returncode': -1,
                'command': ' '.join(full_command),
                'timestamp': datetime.now().isoformat()
            }
        except FileNotFoundError:
            return {
                'success': False,
                'error': 'kubectl not found - please install kubectl or ensure it\'s in PATH',
                'stdout': '',
                'stderr': 'kubectl command not found',
                'returncode': -1,
                'command': 'kubectl',
                'timestamp': datetime.now().isoformat(),
                'kubectl_available': False
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'stdout': '',
                'stderr': str(e),
                'returncode': -1,
                'command': ' '.join(full_command) if 'full_command' in locals() else 'kubectl',
                'timestamp': datetime.now().isoformat()
            }
    
    def get_namespaces(self) -> Dict[str, Any]:
        """Get all namespaces"""
        return self._run_kubectl_command(['get', 'namespaces', '-o', 'json'])
    
    def get_nodes(self) -> Dict[str, Any]:
        """Get all nodes with detailed information"""
        return self._run_kubectl_command(['get', 'nodes', '-o', 'json'])
    
    def get_pods(self, namespace: str = 'all') -> Dict[str, Any]:
        """Get pods, optionally filtered by namespace"""
        if namespace == 'all':
            return self._run_kubectl_command(['get', 'pods', '--all-namespaces', '-o', 'json'])
        else:
            return self._run_kubectl_command(['get', 'pods', '-n', namespace, '-o', 'json'])
    
    def get_deployments(self, namespace: str = 'all') -> Dict[str, Any]:
        """Get deployments, optionally filtered by namespace"""
        if namespace == 'all':
            return self._run_kubectl_command(['get', 'deployments', '--all-namespaces', '-o', 'json'])
        else:
            return self._run_kubectl_command(['get', 'deployments', '-n', namespace, '-o', 'json'])
    
    def get_services(self, namespace: str = 'all') -> Dict[str, Any]:
        """Get services, optionally filtered by namespace"""
        if namespace == 'all':
            return self._run_kubectl_command(['get', 'services', '--all-namespaces', '-o', 'json'])
        else:
            return self._run_kubectl_command(['get', 'services', '-n', namespace, '-o', 'json'])
    
    def get_events(self, namespace: str = 'all') -> Dict[str, Any]:
        """Get events, optionally filtered by namespace"""
        if namespace == 'all':
            return self._run_kubectl_command(['get', 'events', '--all-namespaces', '-o', 'json'])
        else:
            return self._run_kubectl_command(['get', 'events', '-n', namespace, '-o', 'json'])
    
    def get_pod_logs(self, pod_name: str, namespace: str, lines: int = 50) -> Dict[str, Any]:
        """Get logs for a specific pod"""
        return self._run_kubectl_command([
            'logs', pod_name, '-n', namespace, '--tail', str(lines)
        ])
    
    def describe_pod(self, pod_name: str, namespace: str) -> Dict[str, Any]:
        """Describe a specific pod"""
        return self._run_kubectl_command(['describe', 'pod', pod_name, '-n', namespace])
    
    def get_pod_logs(self, namespace: str, pod_name: str, tail_lines: int = 1000) -> Dict[str, Any]:
        """Get logs for a specific pod"""
        try:
            result = self._run_kubectl_command([
                'logs', pod_name, '-n', namespace, '--tail', str(tail_lines)
            ])
            
            if result['success']:
                return {
                    'success': True,
                    'logs': result['stdout'],
                    'timestamp': result['timestamp']
                }
            else:
                return {
                    'success': False,
                    'error': result.get('stderr', 'Failed to get pod logs'),
                    'logs': ''
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'logs': ''
            }
    
    def read_pod_file(self, namespace: str, pod_name: str, file_path: str) -> Dict[str, Any]:
        """Read file content from inside a pod (READ ONLY)"""
        try:
            # Verify file path is safe (READ ONLY operations)
            is_safe, safety_reason = self._verify_file_path_safety(file_path)
            if not is_safe:
                return {
                    'success': False,
                    'error': f'File access denied for safety reasons: {safety_reason}',
                    'content': ''
                }
            
            result = self._run_kubectl_command([
                'exec', pod_name, '-n', namespace, '--', 'cat', file_path
            ])
            
            if result['success']:
                return {
                    'success': True,
                    'content': result['stdout'],
                    'timestamp': result['timestamp']
                }
            else:
                return {
                    'success': False,
                    'error': result.get('stderr', 'Failed to read file'),
                    'content': ''
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'content': ''
            }
    
    def browse_pod_files(self, namespace: str, pod_name: str, path: str = '/') -> Dict[str, Any]:
        """Browse files inside a pod (READ ONLY)"""
        try:
            # Verify path is safe (READ ONLY operations)
            is_safe, safety_reason = self._verify_file_path_safety(path)
            if not is_safe:
                return {
                    'success': False,
                    'error': f'Path access denied for safety reasons: {safety_reason}',
                    'files': []
                }
            
            result = self._run_kubectl_command([
                'exec', pod_name, '-n', namespace, '--', 'ls', '-la', path
            ])
            
            if result['success']:
                # Parse ls output to structured file list
                files = self._parse_ls_output(result['stdout'])
                return {
                    'success': True,
                    'files': files,
                    'current_path': path,
                    'timestamp': result['timestamp']
                }
            else:
                return {
                    'success': False,
                    'error': result.get('stderr', 'Failed to list files'),
                    'files': []
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'files': []
            }
    
    def _verify_file_path_safety(self, path: str) -> Tuple[bool, str]:
        """Verify file path is safe for READ ONLY operations"""
        try:
            # Normalize path
            path = path.strip()
            if not path:
                path = '/'
            
            # READ ONLY means we can access any file safely
            # No write operations are allowed, only ls and cat
            
            # Basic validation - prevent command injection
            if any(char in path for char in ['|', '&', ';', '`', '$', '(', ')']):
                return False, "Invalid characters in path"
            
            # Allow any path since it's read-only
            return True, "Path is safe for read access"
            
        except Exception as e:
            return False, f"Error verifying path: {str(e)}"
    
    def _parse_ls_output(self, ls_output: str) -> List[Dict[str, Any]]:
        """Parse ls -la output into structured file list"""
        try:
            files = []
            lines = ls_output.strip().split('\n')
            
            for line in lines:
                if not line.strip() or line.startswith('total'):
                    continue
                
                # Parse ls -la format
                # Example: -rw-r--r-- 1 root root  1234 Jan 1 12:00 filename
                parts = line.split()
                if len(parts) < 9:
                    continue
                
                permissions = parts[0]
                owner = parts[2]
                group = parts[3]
                size = parts[4] if parts[4].isdigit() else '0'
                filename = ' '.join(parts[8:])
                
                # Determine file type
                file_type = 'file'
                if permissions.startswith('d'):
                    file_type = 'directory'
                elif permissions.startswith('l'):
                    file_type = 'symlink'
                elif permissions.startswith('c'):
                    file_type = 'character'
                elif permissions.startswith('b'):
                    file_type = 'block'
                
                files.append({
                    'name': filename,
                    'type': file_type,
                    'permissions': permissions,
                    'owner': owner,
                    'group': group,
                    'size': size,
                    'modified': ' '.join(parts[5:8]) if len(parts) > 8 else ''
                })
            
            return files
            
        except Exception as e:
            logger.error(f"Error parsing ls output: {str(e)}")
            return []
    
    def describe_deployment(self, deployment_name: str, namespace: str) -> Dict[str, Any]:
        """Describe a specific deployment"""
        return self._run_kubectl_command(['describe', 'deployment', deployment_name, '-n', namespace])
    
    def get_cluster_health(self) -> Dict[str, Any]:
        """Get overall cluster health status"""
        health_data = {
            'timestamp': datetime.now().isoformat(),
            'namespaces': self.get_namespaces(),
            'pods': self.get_pods(),
            'deployments': self.get_deployments(),
            'events': self.get_events()
        }
        return health_data
    
    def analyze_pod_issues(self, pod_name: str, namespace: str) -> Dict[str, Any]:
        """Comprehensive analysis of a specific pod"""
        analysis = {
            'pod_info': self._run_kubectl_command(['get', 'pod', pod_name, '-n', namespace, '-o', 'json']),
            'pod_logs': self.get_pod_logs(pod_name, namespace),
            'pod_describe': self.describe_pod(pod_name, namespace),
            'namespace_events': self.get_events(namespace),
            'timestamp': datetime.now().isoformat()
        }
        return analysis
    
    def execute_commands_for_intent(self, intent: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Execute appropriate kubectl commands based on user intent
        Args:
            intent: Processed intent from NLP processor
        Returns:
            K8s data relevant to the intent
        """
        try:
            intent_type = intent.get('type', 'unknown')
            
            if intent_type == 'cluster_health':
                return self.get_cluster_health()
            
            elif intent_type == 'pod_analysis':
                pod_name = intent.get('pod_name')
                namespace = intent.get('namespace', 'default')
                if pod_name:
                    return self.analyze_pod_issues(pod_name, namespace)
                else:
                    return self.get_pods(intent.get('namespace', 'all'))
            
            elif intent_type == 'namespace_analysis':
                namespace = intent.get('namespace', 'all')
                return {
                    'pods': self.get_pods(namespace),
                    'deployments': self.get_deployments(namespace),
                    'services': self.get_services(namespace),
                    'events': self.get_events(namespace),
                    'timestamp': datetime.now().isoformat()
                }
            
            elif intent_type == 'deployment_analysis':
                deployment_name = intent.get('deployment_name')
                namespace = intent.get('namespace', 'default')
                if deployment_name:
                    return {
                        'deployment_info': self._run_kubectl_command([
                            'get', 'deployment', deployment_name, '-n', namespace, '-o', 'json'
                        ]),
                        'deployment_describe': self.describe_deployment(deployment_name, namespace),
                        'related_pods': self.get_pods(namespace),
                        'namespace_events': self.get_events(namespace),
                        'timestamp': datetime.now().isoformat()
                    }
                else:
                    return self.get_deployments(intent.get('namespace', 'all'))
            
            else:
                # Default: get basic cluster overview
                return {
                    'pods': self.get_pods(),
                    'deployments': self.get_deployments(),
                    'events': self.get_events(),
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error executing commands for intent {intent}: {str(e)}")
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def get_pods_by_namespace(self) -> Dict[str, Any]:
        """
        Get all pods grouped by namespace with detailed information for UI display
        Returns:
            Dictionary with namespaces and their pods
        """
        try:
            # Get all pods across all namespaces
            pods_result = self.get_pods('all')
            
            if not pods_result['success']:
                return {
                    'success': False,
                    'error': pods_result.get('error', 'Failed to get pods'),
                    'namespaces': []
                }
            
            # Parse JSON output
            import json
            pods_data = json.loads(pods_result['stdout'])
            pods = pods_data.get('items', [])
            
            # Group pods by namespace
            namespaces_dict = {}
            
            for pod in pods:
                # Extract namespace
                namespace = pod.get('metadata', {}).get('namespace', 'default')
                
                # Initialize namespace if not exists
                if namespace not in namespaces_dict:
                    namespaces_dict[namespace] = {
                        'name': namespace,
                        'pods': []
                    }
                
                # Extract pod information
                pod_name = pod.get('metadata', {}).get('name', '')
                pod_status = pod.get('status', {}).get('phase', 'Unknown')
                
                # Get container ready status
                ready_status = '0/0'
                containers = pod.get('spec', {}).get('containers', [])
                total_containers = len(containers)
                
                ready_containers = 0
                for status in pod.get('status', {}).get('containerStatuses', []):
                    if status.get('ready', False):
                        ready_containers += 1
                
                if total_containers > 0:
                    ready_status = f"{ready_containers}/{total_containers}"
                
                # Get restart count
                restart_count = 0
                for status in pod.get('status', {}).get('containerStatuses', []):
                    restart_count += status.get('restartCount', 0)
                
                # Get pod age
                creation_time = pod.get('metadata', {}).get('creationTimestamp', '')
                age = self._calculate_age(creation_time)
                
                # Get node name
                node_name = pod.get('spec', {}).get('nodeName', 'Unknown')
                
                # Determine detailed status
                detailed_status = pod_status
                if pod_status == 'Running':
                    if ready_containers < total_containers:
                        detailed_status = 'NotReady'
                elif pod_status == 'Pending':
                    detailed_status = 'Pending'
                else:
                    # Check for common container states
                    for status in pod.get('status', {}).get('containerStatuses', []):
                        state = status.get('state', {})
                        if 'waiting' in state:
                            waiting_reason = state['waiting'].get('reason', '')
                            if waiting_reason:
                                detailed_status = waiting_reason
                                break
                        elif 'terminated' in state:
                            terminated_reason = state['terminated'].get('reason', '')
                            if terminated_reason:
                                detailed_status = terminated_reason
                                break
                
                # Add pod to namespace
                namespaces_dict[namespace]['pods'].append({
                    'name': pod_name,
                    'status': detailed_status,
                    'ready': ready_status,
                    'restarts': restart_count,
                    'age': age,
                    'node': node_name
                })
            
            # Convert to list format and add pod counts
            namespaces_list = []
            for namespace_name, namespace_data in namespaces_dict.items():
                namespaces_list.append({
                    'name': namespace_data['name'],
                    'pod_count': len(namespace_data['pods']),
                    'pods': namespace_data['pods']
                })
            
            # Sort namespaces alphabetically
            namespaces_list.sort(key=lambda x: x['name'])
            
            return {
                'success': True,
                'namespaces': namespaces_list,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting pods by namespace: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'namespaces': []
            }
    
    def _calculate_age(self, creation_timestamp: str) -> str:
        """Calculate human-readable age from creation timestamp"""
        try:
            from datetime import datetime
            import re
            
            # Parse ISO 8601 timestamp
            # Handle both formats: "2023-12-14T10:30:00Z" and "2023-12-14T10:30:00.123456Z"
            timestamp_str = re.sub(r'\.\d+', '', creation_timestamp.rstrip('Z'))
            creation_time = datetime.fromisoformat(timestamp_str)
            
            now = datetime.now()
            age_delta = now - creation_time
            
            # Calculate days, hours, minutes
            days = age_delta.days
            hours = age_delta.seconds // 3600
            minutes = (age_delta.seconds % 3600) // 60
            
            if days > 0:
                return f"{days}d"
            elif hours > 0:
                return f"{hours}h"
            elif minutes > 0:
                return f"{minutes}m"
            else:
                return "Just now"
                
        except Exception as e:
            logger.warning(f"Error calculating age from timestamp {creation_timestamp}: {e}")
            return "Unknown"

# Add import for os at the top
import os