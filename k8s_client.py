import subprocess
import json
import logging
import re
import os
from typing import Dict, List, Optional, Any
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

# Add import for os at the top
import os