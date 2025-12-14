import requests
import json
import logging
import re
from typing import Dict, List, Any, Optional, Generator
from datetime import datetime
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    def generate_response_stream(self, user_message: str, intent: Dict[str, Any], 
                                 k8s_data: Optional[Dict[str, Any]], 
                                 conversation_history: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """Generate streaming response"""
        pass
    
    @abstractmethod
    def generate_response(self, user_message: str, intent: Dict[str, Any], 
                          k8s_data: Optional[Dict[str, Any]], 
                          conversation_history: List[Dict[str, Any]]) -> str:
        """Generate non-streaming response"""
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to the LLM provider"""
        pass
    
    @abstractmethod
    def get_provider_info(self) -> Dict[str, Any]:
        """Get provider information"""
        pass

class OpenRouterProvider(LLMProvider):
    """OpenRouter API provider for LLM integration"""
    
    def __init__(self, api_key: str = None, model: str = "minimax/minimax-01"):
        """Initialize OpenRouter provider"""
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.api_key = api_key
        self.model = model
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:5000",
            "X-Title": "K8s Smart Bot",
            "Content-Type": "application/json"
        }
    
    def generate_response_stream(self, user_message: str, intent: Dict[str, Any], 
                                 k8s_data: Optional[Dict[str, Any]], 
                                 conversation_history: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """Generate streaming response using OpenRouter API"""
        try:
            # Build the system prompt
            system_prompt = self._build_enhanced_system_prompt(intent, k8s_data)
            
            # Build conversation messages
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # Add conversation history (last 10 messages to avoid context limit)
            recent_history = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
            for msg in recent_history:
                if msg['role'] == 'user':
                    messages.append({"role": "user", "content": msg['message']})
                elif msg['role'] == 'assistant':
                    messages.append({"role": "assistant", "content": msg['message']})
            
            # Add current user message
            messages.append({"role": "user", "content": user_message})
            
            # Prepare request payload for streaming
            payload = {
                "model": self.model,
                "max_tokens": 2000,
                "messages": messages,
                "temperature": 0.7,
                "stream": True
            }
            
            logger.info(f"Sending streaming request to OpenRouter with intent: {intent.get('type')}")
            
            # Make streaming API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                stream=True,
                timeout=60
            )
            
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            data_str = line[6:]  # Remove 'data: ' prefix
                            if data_str == '[DONE]':
                                break
                            
                            try:
                                data = json.loads(data_str)
                                if 'choices' in data and len(data['choices']) > 0:
                                    delta = data['choices'][0].get('delta', {})
                                    content = delta.get('content', '')
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
                
                logger.info("Successfully completed streaming response from OpenRouter")
            else:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                # Fallback to non-streaming response
                fallback_response = self._generate_enhanced_fallback_response(intent, k8s_data)
                for chunk in fallback_response:
                    yield chunk
                
        except requests.exceptions.Timeout:
            logger.error("OpenRouter API request timed out")
            fallback_response = self._generate_enhanced_fallback_response(intent, k8s_data)
            for chunk in fallback_response:
                yield chunk
        except Exception as e:
            logger.error(f"Error generating streaming response: {str(e)}")
            fallback_response = self._generate_enhanced_fallback_response(intent, k8s_data)
            for chunk in fallback_response:
                yield chunk
    
    def generate_response(self, user_message: str, intent: Dict[str, Any], 
                          k8s_data: Optional[Dict[str, Any]], 
                          conversation_history: List[Dict[str, Any]]) -> str:
        """Generate non-streaming response using OpenRouter API"""
        try:
            # Build the system prompt
            system_prompt = self._build_enhanced_system_prompt(intent, k8s_data)
            
            # Build conversation messages
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # Add conversation history (last 10 messages to avoid context limit)
            recent_history = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
            for msg in recent_history:
                if msg['role'] == 'user':
                    messages.append({"role": "user", "content": msg['message']})
                elif msg['role'] == 'assistant':
                    messages.append({"role": "assistant", "content": msg['message']})
            
            # Add current user message
            messages.append({"role": "user", "content": user_message})
            
            # Prepare request payload
            payload = {
                "model": self.model,
                "max_tokens": 2000,
                "messages": messages,
                "temperature": 0.7
            }
            
            logger.info(f"Sending request to OpenRouter with intent: {intent.get('type')}")
            
            # Make API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                logger.info("Successfully generated response from OpenRouter")
                return content
            else:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return self._generate_enhanced_fallback_response(intent, k8s_data)
                
        except requests.exceptions.Timeout:
            logger.error("OpenRouter API request timed out")
            return self._generate_enhanced_fallback_response(intent, k8s_data)
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return self._generate_enhanced_fallback_response(intent, k8s_data)
    
    def suggest_commands(self, user_question: str, conversation_history: List[Dict[str, Any]]) -> List[str]:
        """Suggest appropriate kubectl commands based on user question"""
        try:
            # Build a focused prompt for command suggestion
            system_prompt = """You are a Kubernetes expert. Based on the user's question, suggest the most appropriate kubectl commands to investigate their issue.

Guidelines:
- Suggest ONLY read-only kubectl commands (get, describe, logs, top)
- Focus on the specific resources mentioned (pods, deployments, services, nodes, etc.)
- Be specific with resource names when possible
- Limit to 1-3 essential commands
- Format as a simple list of commands only, no explanations

Example:
User: "Why is my nginx pod failing?"
Commands:
- kubectl get pods -l app=nginx
- kubectl describe pod <nginx-pod-name>
- kubectl logs <nginx-pod-name>"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User question: {user_question}"}
            ]
            
            payload = {
                "model": self.model,
                "max_tokens": 500,
                "messages": messages,
                "temperature": 0.3
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Extract commands from the response
                commands = []
                for line in content.split('\n'):
                    line = line.strip()
                    if line.startswith('kubectl ') or 'kubectl ' in line:
                        # Extract the command
                        if 'kubectl ' in line:
                            parts = line.split('kubectl ')
                            for part in parts:
                                if part.strip():
                                    commands.append(f"kubectl {part.strip()}")
                        else:
                            commands.append(line.strip())
                
                return commands[:3]  # Limit to 3 commands
            
            return []
            
        except Exception as e:
            logger.error(f"Error suggesting commands: {str(e)}")
            return []
    
    def analyze_command_outputs(self, user_question: str, command_outputs: Dict[str, Any], 
                            conversation_history: List[Dict[str, Any]]) -> str:
        """Analyze kubectl command outputs and provide insights"""
        try:
            # Build a focused prompt for output analysis
            system_prompt = """You are a Kubernetes expert analyzing command outputs to help the user. 

Your task:
1. Analyze the provided kubectl command outputs
2. Identify any issues, problems, or important information
3. Provide clear, actionable insights
4. Suggest specific next steps if there are problems
5. Be conversational and helpful

Focus on:
- Pod status issues (CrashLoopBackOff, ImagePullBackOff, Pending, etc.)
- Resource constraints (CPU, memory)
- Configuration problems
- Network issues
- Error messages and their meanings

Be honest about what you can and cannot determine from the outputs."""

            # Format command outputs for the prompt
            outputs_text = ""
            if command_outputs:
                for cmd, output in command_outputs.items():
                    outputs_text += f"\n\nCommand: {cmd}\n"
                    if output.get('success'):
                        outputs_text += f"Output:\n{output.get('stdout', 'No output')}\n"
                    else:
                        outputs_text += f"Error:\n{output.get('stderr', 'Unknown error')}\n"
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User question: {user_question}\n\nCommand outputs:{outputs_text}"}
            ]
            
            payload = {
                "model": self.model,
                "max_tokens": 1500,
                "messages": messages,
                "temperature": 0.7
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content']
            else:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
                
        except Exception as e:
            logger.error(f"Error analyzing command outputs: {str(e)}")
            return self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
    
    def suggest_follow_up_commands(self, original_question: str, discovery_outputs: Dict[str, Any], 
                                conversation_history: List[Dict[str, Any]]) -> List[str]:
        """Suggest follow-up commands based on initial investigation"""
        try:
            # Build a focused prompt for follow-up command suggestion
            system_prompt = """You are a Kubernetes expert. Based on the initial investigation results, suggest follow-up commands to dig deeper into any issues found.

Guidelines:
- Suggest ONLY read-only kubectl commands (get, describe, logs, top, events)
- Focus on investigating problems identified in the first round
- Be specific with resource names and namespaces
- Limit to 1-2 essential follow-up commands
- Consider what additional information would be most helpful

Examples:
If pods are failing: check pod logs, describe pods, check events
If deployments have issues: check deployment status, check replica sets
If resource issues: check resource quotas, node status"""

            # Format discovery outputs for the prompt
            outputs_text = ""
            if discovery_outputs:
                for cmd, output in discovery_outputs.items():
                    outputs_text += f"\n\nCommand: {cmd}\n"
                    if output.get('success'):
                        outputs_text += f"Output:\n{output.get('stdout', 'No output')}\n"
                    else:
                        outputs_text += f"Error:\n{output.get('stderr', 'Unknown error')}\n"
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Original question: {original_question}\n\nInitial investigation results:{outputs_text}\n\nSuggest 1-2 follow-up commands to investigate further."}
            ]
            
            payload = {
                "model": self.model,
                "max_tokens": 500,
                "messages": messages,
                "temperature": 0.5
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=20
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Extract commands from the response
                commands = []
                for line in content.split('\n'):
                    line = line.strip()
                    if line.startswith('kubectl ') or 'kubectl ' in line:
                        # Extract the command
                        if 'kubectl ' in line:
                            parts = line.split('kubectl ')
                            for part in parts:
                                if part.strip():
                                    commands.append(f"kubectl {part.strip()}")
                        else:
                            commands.append(line.strip())
                
                return commands[:2]  # Limit to 2 follow-up commands
            
            return []
            
        except Exception as e:
            logger.error(f"Error suggesting follow-up commands: {str(e)}")
            return []
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to OpenRouter API"""
        try:
            test_payload = {
                "model": self.model,
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "test"}],
                "temperature": 0.1
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=test_payload,
                timeout=10
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "OpenRouter connection successful",
                    "model": self.model,
                    "response_time": response.elapsed.total_seconds()
                }
            else:
                return {
                    "success": False,
                    "message": f"OpenRouter API error: {response.status_code} - {response.text}",
                    "error": response.text
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"OpenRouter connection failed: {str(e)}",
                "error": str(e)
            }
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get OpenRouter provider information"""
        return {
            "provider": "openrouter",
            "model": self.model,
            "api_url": self.api_url,
            "supports_streaming": True,
            "description": "OpenRouter API - Multi-model LLM service"
        }
    
    def _build_enhanced_system_prompt(self, intent: Dict[str, Any], k8s_data: Optional[Dict[str, Any]]) -> str:
        """Build smart, context-aware system prompt based on intent and K8s data"""
        
        base_prompt = """You are a friendly Kubernetes assistant that talks like a helpful coworker. Be casual and conversational.

RESPONSE STYLE RULES:
1. Match your response style to the question complexity
2. Simple questions get simple, direct answers
3. Only investigate when there are actual problems
4. Use casual language like "Hey!", "Looks like", "Oh, interesting"
5. No need for summaries, next steps, or follow-ups unless there's a real problem

SIMPLE QUESTIONS (get direct answers):
- "what pods are in my default ns" → Just list the pods
- "show me services" → Just list the services  
- "list deployments" → Just list the deployments
- "check namespaces" → Just list the namespaces

COMPLEX QUESTIONS (get investigation):
- "what's wrong with my pods?" → Investigate problems
- "investigate deployment issues" → Analyze problems
- "why is my service failing?" → Troubleshoot issues

PROBLEM DETECTION:
- ONLY investigate when you find actual issues (CrashLoopBackOff, ImagePullBackOff, Pending, etc.)
- If everything looks good, just say "Everything looks good!" or "All running normally"
- When you see a problem, say something like "Oh, interesting - we have a pod that's stuck" or "Hey, looks like this service needs attention"

DATA HANDLING:
- If k8s_data is empty or has errors, say "I can't connect to your cluster right now"
- Only use real data from the cluster
- Don't make up information

RESPONSE FORMATTING:
- Use casual, conversational tone
- For simple lists: just bullet points
- For problems: explain what you see and suggest what to look at
- Format commands in ```bash blocks when suggesting them
- No fancy sections unless there's a real problem to solve"""

        # Add context-specific instructions based on intent
        intent_type = intent.get('type', 'unknown')
        
        if intent_type == 'cluster_health':
            base_prompt += """

CLUSTER HEALTH:
- Just give me the overview of what you see
- If there are problems, point them out casually like "Hey, noticed a few pods having issues"
- If everything looks good, just say "Cluster looks healthy!"""

        elif intent_type == 'pod_analysis':
            base_prompt += """

POD ANALYSIS:
- For listing questions: just show the pod names and statuses
- If you see pods with problems (not Running), mention them casually
- Example: "Got 2 pods here. Oh, interesting - one is stuck in ImagePullBackOff"
- Only investigate if the user asks "what's wrong" or you see actual problems"""

        elif intent_type == 'namespace_analysis':
            base_prompt += """

NAMESPACE ANALYSIS:
- Just list what's in the namespace
- If everything looks good, say "All good in this namespace!"
- If you see problems, mention them casually like "Hmm, some services here are stuck"""

        elif intent_type == 'deployment_analysis':
            base_prompt += """

DEPLOYMENT ANALYSIS:
- Show deployment statuses directly
- If deployments are healthy, just say "Deployments look good!"
- If some are failing, say "Oh, looks like a few deployments need attention" """

        elif intent_type == 'service_analysis':
            base_prompt += """

SERVICE ANALYSIS:
- List services and their status
- If you see services stuck on Pending or have issues, mention them casually
- Example: "Got 3 services here. Hey, one of them is still waiting for an external IP\""""

        # Add K8s data context if available
        if k8s_data and self._has_meaningful_data(k8s_data):
            base_prompt += f"""

REAL KUBERNETES DATA (use this information only):
{json.dumps(k8s_data, indent=2, default=str)[:3000]}..."""
        else:
            # Check if there are kubectl connection issues
            kubectl_available = True
            cluster_accessible = True
            connection_error = None
            
            if k8s_data:
                # Check for kubectl availability issues
                for key, data in k8s_data.items():
                    if isinstance(data, dict):
                        if not data.get('kubectl_available', True):
                            kubectl_available = False
                        if not data.get('cluster_accessible', True):
                            cluster_accessible = False
                        if data.get('error'):
                            connection_error = data.get('error')
            
            if not kubectl_available:
                base_prompt += """

KUBECTL NOT AVAILABLE:
- kubectl command is not installed or not found in PATH
- Please install kubectl or ensure it's available in the system
- Suggest: Install kubectl from https://kubernetes.io/docs/tasks/tools/"""
            elif not cluster_accessible or connection_error:
                base_prompt += f"""

CLUSTER CONNECTION ISSUE:
- I cannot connect to your Kubernetes cluster
- Error: {connection_error or 'Connection refused or no configuration found'}
- Please ensure your cluster is running and kubeconfig is properly configured
- Suggest: Check your kubeconfig file at ~/.kube/config"""
            else:
                base_prompt += """

NO REAL KUBERNETES DATA AVAILABLE:
- I don't have access to your real Kubernetes cluster
- Do not make up any cluster information
- Do not mention "data you provided" unless it's meaningful
- Suggest commands the user can run to get real data
- Be honest that I need to connect to their actual cluster"""

        base_prompt += """

Remember: Be honest about what you know vs. what you're suggesting. Never make up Kubernetes information. If I don't have real data or cannot connect to the cluster, say so clearly."""
        
        return base_prompt
    
    def _has_meaningful_data(self, k8s_data: Dict[str, Any]) -> bool:
        """Check if the Kubernetes data contains meaningful cluster information"""
        if not k8s_data:
            return False
        
        # Check if there's actual cluster data (not just error messages or empty responses)
        meaningful_keys = ['pods', 'namespaces', 'deployments', 'services']
        
        for key in meaningful_keys:
            if key in k8s_data:
                data = k8s_data[key]
                # Check if the data is not just an error or empty response
                if (isinstance(data, dict) and 
                    data.get('success') and 
                    data.get('stdout') and 
                    data.get('kubectl_available', True) and
                    data.get('cluster_accessible', True)):
                    
                    # Try to parse the stdout as JSON to see if it contains actual items
                    try:
                        stdout_data = json.loads(data.get('stdout', '{}'))
                        if 'items' in stdout_data and len(stdout_data['items']) > 0:
                            return True
                    except (json.JSONDecodeError, TypeError):
                        # If JSON parsing fails, check if stdout has meaningful content
                        if data.get('stdout') and len(data.get('stdout', '').strip()) > 0:
                            return True
        
        return False
    
    def _generate_enhanced_fallback_response(self, intent: Dict[str, Any], k8s_data: Optional[Dict[str, Any]]) -> str:
        """Generate enhanced fallback response when API is unavailable"""
        
        intent_type = intent.get('type', 'unknown')
        
        if intent_type == 'cluster_health':
            return """I'm having trouble connecting to my AI service right now, but I can help you with cluster health analysis.

**To check your cluster health, run:**
```bash
kubectl cluster-info
kubectl get nodes
kubectl get namespaces
kubectl get pods --all-namespaces
```

**What to look for:**
- Nodes in Ready status
- Namespaces in Active status
- Pods in Running state
- Any error conditions"""
        
        elif intent_type == 'pod_analysis':
            return """I'm having trouble connecting to my AI service right now. For pod analysis, try these commands:

```bash
# List all pods
kubectl get pods --all-namespaces

# Get detailed pod information
kubectl describe pods

# Check pod logs
kubectl logs <pod-name>

# Filter by namespace
kubectl get pods -n <namespace>
```

Look for pods with issues like:
- CrashLoopBackOff
- ImagePullBackOff
- Pending
- Error"""
        
        else:
            return """I'm having trouble connecting to my AI service right now. Please try again in a few moments, or contact your administrator if the issue persists.

In the meantime, you can use these basic kubectl commands:
```bash
kubectl get pods
kubectl get services
kubectl get deployments
kubectl get nodes
```"""


class LocalLLMProvider(LLMProvider):
    """Local LLM provider for self-hosted models"""
    
    def __init__(self, endpoint_url: str = "http://localhost:8080", model: str = "default"):
        """Initialize Local LLM provider"""
        self.endpoint_url = endpoint_url.rstrip('/')
        self.model = model
        self.api_url = f"{self.endpoint_url}/v1/chat/completions"
        self.headers = {
            "Content-Type": "application/json"
        }
    
    def generate_response_stream(self, user_message: str, intent: Dict[str, Any], 
                                 k8s_data: Optional[Dict[str, Any]], 
                                 conversation_history: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """Generate streaming response using local LLM endpoint"""
        try:
            # Build the system prompt
            system_prompt = self._build_enhanced_system_prompt(intent, k8s_data)
            
            # Build conversation messages
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # Add conversation history (last 10 messages to avoid context limit)
            recent_history = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
            for msg in recent_history:
                if msg['role'] == 'user':
                    messages.append({"role": "user", "content": msg['message']})
                elif msg['role'] == 'assistant':
                    messages.append({"role": "assistant", "content": msg['message']})
            
            # Add current user message
            messages.append({"role": "user", "content": user_message})
            
            # Prepare request payload for streaming
            payload = {
                "model": self.model,
                "max_tokens": 2000,
                "messages": messages,
                "temperature": 0.7,
                "stream": True
            }
            
            logger.info(f"Sending streaming request to Local LLM at {self.endpoint_url} with intent: {intent.get('type')}")
            
            # Make streaming API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                stream=True,
                timeout=60
            )
            
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            data_str = line[6:]  # Remove 'data: ' prefix
                            if data_str == '[DONE]':
                                break
                            
                            try:
                                data = json.loads(data_str)
                                if 'choices' in data and len(data['choices']) > 0:
                                    delta = data['choices'][0].get('delta', {})
                                    content = delta.get('content', '')
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
                
                logger.info("Successfully completed streaming response from Local LLM")
            else:
                logger.error(f"Local LLM API error: {response.status_code} - {response.text}")
                # Fallback to non-streaming response
                fallback_response = self._generate_enhanced_fallback_response(intent, k8s_data)
                for chunk in fallback_response:
                    yield chunk
                
        except requests.exceptions.Timeout:
            logger.error("Local LLM API request timed out")
            fallback_response = self._generate_enhanced_fallback_response(intent, k8s_data)
            for chunk in fallback_response:
                yield chunk
        except Exception as e:
            logger.error(f"Error generating streaming response: {str(e)}")
            fallback_response = self._generate_enhanced_fallback_response(intent, k8s_data)
            for chunk in fallback_response:
                yield chunk
    
    def generate_response(self, user_message: str, intent: Dict[str, Any], 
                          k8s_data: Optional[Dict[str, Any]], 
                          conversation_history: List[Dict[str, Any]]) -> str:
        """Generate non-streaming response using local LLM endpoint"""
        try:
            # Build the system prompt
            system_prompt = self._build_enhanced_system_prompt(intent, k8s_data)
            
            # Build conversation messages
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # Add conversation history (last 10 messages to avoid context limit)
            recent_history = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
            for msg in recent_history:
                if msg['role'] == 'user':
                    messages.append({"role": "user", "content": msg['message']})
                elif msg['role'] == 'assistant':
                    messages.append({"role": "assistant", "content": msg['message']})
            
            # Add current user message
            messages.append({"role": "user", "content": user_message})
            
            # Prepare request payload
            payload = {
                "model": self.model,
                "max_tokens": 2000,
                "messages": messages,
                "temperature": 0.7
            }
            
            logger.info(f"Sending request to Local LLM at {self.endpoint_url} with intent: {intent.get('type')}")
            
            # Make API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                logger.info("Successfully generated response from Local LLM")
                return content
            else:
                logger.error(f"Local LLM API error: {response.status_code} - {response.text}")
                return self._generate_enhanced_fallback_response(intent, k8s_data)
                
        except requests.exceptions.Timeout:
            logger.error("Local LLM API request timed out")
            return self._generate_enhanced_fallback_response(intent, k8s_data)
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return self._generate_enhanced_fallback_response(intent, k8s_data)
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to Local LLM endpoint"""
        try:
            test_payload = {
                "model": self.model,
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "test"}],
                "temperature": 0.1
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=test_payload,
                timeout=10
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Local LLM connection successful",
                    "model": self.model,
                    "endpoint": self.endpoint_url,
                    "response_time": response.elapsed.total_seconds()
                }
            else:
                return {
                    "success": False,
                    "message": f"Local LLM API error: {response.status_code} - {response.text}",
                    "error": response.text
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"Local LLM connection failed: {str(e)}",
                "error": str(e)
            }
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get Local LLM provider information"""
        return {
            "provider": "local",
            "model": self.model,
            "endpoint_url": self.endpoint_url,
            "api_url": self.api_url,
            "supports_streaming": True,
            "description": "Self-hosted Local LLM endpoint"
        }
    
    def suggest_commands(self, user_question: str, conversation_history: List[Dict[str, Any]]) -> List[str]:
        """Suggest appropriate kubectl commands based on user question"""
        try:
            # Build a focused prompt for command suggestion
            system_prompt = """You are a Kubernetes expert. Based on the user's question, suggest the most appropriate kubectl commands to investigate their issue.

Guidelines:
- Suggest ONLY read-only kubectl commands (get, describe, logs, top)
- Focus on the specific resources mentioned (pods, deployments, services, nodes, etc.)
- Be specific with resource names when possible
- Limit to 1-3 essential commands
- Format as a simple list of commands only, no explanations

Example:
User: "Why is my nginx pod failing?"
Commands:
- kubectl get pods -l app=nginx
- kubectl describe pod <nginx-pod-name>
- kubectl logs <nginx-pod-name>"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User question: {user_question}"}
            ]
            
            payload = {
                "model": self.model,
                "max_tokens": 500,
                "messages": messages,
                "temperature": 0.3
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Extract commands from the response
                commands = []
                for line in content.split('\n'):
                    line = line.strip()
                    if line.startswith('kubectl ') or 'kubectl ' in line:
                        # Extract the command
                        if 'kubectl ' in line:
                            parts = line.split('kubectl ')
                            for part in parts:
                                if part.strip():
                                    commands.append(f"kubectl {part.strip()}")
                        else:
                            commands.append(line.strip())
                
                return commands[:3]  # Limit to 3 commands
            
            return []
            
        except Exception as e:
            logger.error(f"Error suggesting commands: {str(e)}")
            return []
    
    def analyze_command_outputs(self, user_question: str, command_outputs: Dict[str, Any], 
                            conversation_history: List[Dict[str, Any]]) -> str:
        """Analyze kubectl command outputs and provide insights"""
        try:
            # Build a focused prompt for output analysis
            system_prompt = """You are a Kubernetes expert analyzing command outputs to help the user. 

Your task:
1. Analyze the provided kubectl command outputs
2. Identify any issues, problems, or important information
3. Provide clear, actionable insights
4. Suggest specific next steps if there are problems
5. Be conversational and helpful

Focus on:
- Pod status issues (CrashLoopBackOff, ImagePullBackOff, Pending, etc.)
- Resource constraints (CPU, memory)
- Configuration problems
- Network issues
- Error messages and their meanings

Be honest about what you can and cannot determine from outputs."""

            # Format command outputs for the prompt
            outputs_text = ""
            if command_outputs:
                for cmd, output in command_outputs.items():
                    outputs_text += f"\n\nCommand: {cmd}\n"
                    if output.get('success'):
                        outputs_text += f"Output:\n{output.get('stdout', 'No output')}\n"
                    else:
                        outputs_text += f"Error:\n{output.get('stderr', 'Unknown error')}\n"
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User question: {user_question}\n\nCommand outputs:{outputs_text}"}
            ]
            
            payload = {
                "model": self.model,
                "max_tokens": 1500,
                "messages": messages,
                "temperature": 0.7
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content']
            else:
                logger.error(f"Local LLM API error: {response.status_code} - {response.text}")
                return self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
                
        except Exception as e:
            logger.error(f"Error analyzing command outputs: {str(e)}")
            return self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
    
    def suggest_follow_up_commands(self, original_question: str, discovery_outputs: Dict[str, Any], 
                                conversation_history: List[Dict[str, Any]]) -> List[str]:
        """Suggest follow-up commands based on initial investigation"""
        try:
            # Build a focused prompt for follow-up command suggestion
            system_prompt = """You are a Kubernetes expert. Based on the initial investigation results, suggest follow-up commands to dig deeper into any issues found.

Guidelines:
- Suggest ONLY read-only kubectl commands (get, describe, logs, top, events)
- Focus on investigating problems identified in the first round
- Be specific with resource names and namespaces
- Limit to 1-2 essential follow-up commands
- Consider what additional information would be most helpful

Examples:
If pods are failing: check pod logs, describe pods, check events
If deployments have issues: check deployment status, check replica sets
If resource issues: check resource quotas, node status"""

            # Format discovery outputs for the prompt
            outputs_text = ""
            if discovery_outputs:
                for cmd, output in discovery_outputs.items():
                    outputs_text += f"\n\nCommand: {cmd}\n"
                    if output.get('success'):
                        outputs_text += f"Output:\n{output.get('stdout', 'No output')}\n"
                    else:
                        outputs_text += f"Error:\n{output.get('stderr', 'Unknown error')}\n"
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Original question: {original_question}\n\nInitial investigation results:{outputs_text}\n\nSuggest 1-2 follow-up commands to investigate further."}
            ]
            
            payload = {
                "model": self.model,
                "max_tokens": 500,
                "messages": messages,
                "temperature": 0.5
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=20
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Extract commands from the response
                commands = []
                for line in content.split('\n'):
                    line = line.strip()
                    if line.startswith('kubectl ') or 'kubectl ' in line:
                        # Extract the command
                        if 'kubectl ' in line:
                            parts = line.split('kubectl ')
                            for part in parts:
                                if part.strip():
                                    commands.append(f"kubectl {part.strip()}")
                        else:
                            commands.append(line.strip())
                
                return commands[:2]  # Limit to 2 follow-up commands
            
            return []
            
        except Exception as e:
            logger.error(f"Error suggesting follow-up commands: {str(e)}")
            return []
    
    def _build_enhanced_system_prompt(self, intent: Dict[str, Any], k8s_data: Optional[Dict[str, Any]]) -> str:
        """Build smart, context-aware system prompt based on intent and K8s data"""
        # Use the same prompt building logic as OpenRouter
        openrouter_provider = OpenRouterProvider()
        return openrouter_provider._build_enhanced_system_prompt(intent, k8s_data)
    
    def _has_meaningful_data(self, k8s_data: Dict[str, Any]) -> bool:
        """Check if the Kubernetes data contains meaningful cluster information"""
        # Use the same logic as OpenRouter
        openrouter_provider = OpenRouterProvider()
        return openrouter_provider._has_meaningful_data(k8s_data)
    
    def _generate_enhanced_fallback_response(self, intent: Dict[str, Any], k8s_data: Optional[Dict[str, Any]]) -> str:
        """Generate enhanced fallback response when API is unavailable"""
        # Use the same fallback logic as OpenRouter
        openrouter_provider = OpenRouterProvider()
        return openrouter_provider._generate_enhanced_fallback_response(intent, k8s_data)


class LLMClientFactory:
    """Factory class for creating LLM provider instances"""
    
    @staticmethod
    def create_provider(provider_config: Dict[str, Any]) -> LLMProvider:
        """Create an LLM provider instance based on configuration"""
        provider_type = provider_config.get('provider', '').lower()
        
        if provider_type == 'openrouter':
            api_key = provider_config.get('api_key')
            model = provider_config.get('model', 'minimax/minimax-01')
            
            if not api_key:
                raise ValueError("OpenRouter provider requires an API key")
            
            return OpenRouterProvider(api_key=api_key, model=model)
        
        elif provider_type == 'local':
            endpoint_url = provider_config.get('endpoint_url', 'http://localhost:8080')
            model = provider_config.get('model', 'default')
            
            return LocalLLMProvider(endpoint_url=endpoint_url, model=model)
        
        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")
    
    @staticmethod
    def get_supported_providers() -> List[Dict[str, Any]]:
        """Get list of supported LLM providers"""
        return [
            {
                "provider": "openrouter",
                "name": "OpenRouter API",
                "description": "Cloud-based multi-model LLM service",
                "requires_api_key": True,
                "config_fields": [
                    {"name": "api_key", "type": "string", "required": True, "description": "OpenRouter API key"},
                    {"name": "model", "type": "string", "required": False, "default": "minimax/minimax-01", "description": "Model name"}
                ]
            },
            {
                "provider": "local",
                "name": "Local LLM",
                "description": "Self-hosted local LLM endpoint",
                "requires_api_key": False,
                "config_fields": [
                    {"name": "endpoint_url", "type": "string", "required": False, "default": "http://localhost:8080", "description": "Local LLM endpoint URL"},
                    {"name": "model", "type": "string", "required": False, "default": "default", "description": "Model name"}
                ]
            }
        ]


# Legacy compatibility class
class OpenRouterClient(OpenRouterProvider):
    """Legacy OpenRouter client for backward compatibility"""
    pass