import requests
import json
import logging
import re
from typing import Dict, List, Any, Optional, Generator
from datetime import datetime

logger = logging.getLogger(__name__)

class OpenRouterClient:
    """OpenRouter API client for LLM integration"""
    
    def __init__(self, api_key: str = None):
        """Initialize OpenRouter client with configurable credentials"""
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.api_key = api_key or "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"
        self.model = "minimax/minimax-01"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:5000",
            "X-Title": "K8s Smart Bot",
            "Content-Type": "application/json"
        }
    
    def generate_response_stream(self, user_message: str, intent: Dict[str, Any], 
                                 k8s_data: Optional[Dict[str, Any]], 
                                 conversation_history: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """
        Generate intelligent response using OpenRouter API with streaming
        Args:
            user_message: Original user message
            intent: Processed intent from NLP
            k8s_data: Kubernetes data from commands
            conversation_history: Previous conversation
        Yields:
            Response chunks as they're generated
        """
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
        """
        Generate intelligent response using OpenRouter API (non-streaming version for compatibility)
        """
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
- If everything looks good, just say "Cluster looks healthy!"""""

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

    def _build_system_prompt(self, intent: Dict[str, Any], k8s_data: Optional[Dict[str, Any]]) -> str:
        """Build intelligent system prompt based on intent and K8s data (legacy method)"""
        return self._build_enhanced_system_prompt(intent, k8s_data)
    
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
- Any error conditions

Would you like me to help you interpret the output once you run these commands?"""
        
        elif intent_type == 'pod_analysis':
            pod_name = intent.get('pod_name', 'the specified pod')
            return f"""I'm currently unable to process the analysis for {pod_name}, but here's how you can check it manually:

**To analyze the pod:**
```bash
kubectl get pod {pod_name}
kubectl describe pod {pod_name}
kubectl logs {pod_name}
```

**What to check:**
- Pod status (should be Running)
- Restart count (high restarts indicate issues)
- Recent events for errors
- Log output for error messages

Please try again in a moment for automated analysis."""
        
        elif intent_type == 'namespace_analysis':
            namespace = intent.get('namespace', 'the specified namespace')
            return f"""I'm experiencing temporary connectivity issues. Here's how to analyze the {namespace} namespace:

**To check namespace resources:**
```bash
kubectl get namespaces
kubectl get pods -n {namespace}
kubectl get deployments -n {namespace}
kubectl get services -n {namespace}
```

**What to look for:**
- Resource counts and statuses
- Any failing pods or deployments
- Service endpoint availability

Try again in a moment for automated analysis."""
        
        else:
            return """I'm temporarily unable to process your request due to connectivity issues. 

**Basic cluster commands you can run:**
```bash
kubectl cluster-info
kubectl get nodes
kubectl get pods --all-namespaces
```

Please try again in a moment, and I'll be happy to help with your Kubernetes infrastructure analysis."""
    
    def _generate_fallback_response(self, intent: Dict[str, Any], k8s_data: Optional[Dict[str, Any]]) -> str:
        """Generate fallback response when API is unavailable (legacy method)"""
        return self._generate_enhanced_fallback_response(intent, k8s_data)
    
    def test_connection(self) -> bool:
        """Test connection to OpenRouter API"""
        try:
            test_payload = {
                "model": self.model,
                "max_tokens": 10,
                "messages": [
                    {"role": "user", "content": "test"}
                ]
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=test_payload,
                timeout=10
            )
            
            return response.status_code == 200
            
        except Exception as e:
            logger.error(f"OpenRouter connection test failed: {str(e)}")
            return False

    def _is_simple_listing_question(self, user_message: str) -> bool:
        """Detect if user is asking a simple listing question vs complex investigation"""
        user_message_lower = user_message.lower().strip()
        
        # Simple listing patterns
        simple_patterns = [
            'what pods', 'show me pods', 'list pods', 'get pods',
            'what services', 'show me services', 'list services', 'get services', 
            'what deployments', 'show me deployments', 'list deployments', 'get deployments',
            'what namespaces', 'show me namespaces', 'list namespaces', 'get namespaces',
            'check pods', 'check services', 'check deployments', 'check namespaces',
            'pods in', 'services in', 'deployments in', 'namespaces in',
            'what.*in.*namespace', 'show.*in.*namespace'
        ]
        
        # Complex investigation patterns
        complex_patterns = [
            'what\'s wrong', 'whats wrong', 'what is wrong',
            'investigate', 'troubleshoot', 'diagnose', 'debug',
            'why.*failing', 'why.*error', 'why.*stuck', 'why.*pending',
            'problem', 'issue', 'broken', 'crash', 'error',
            'analyze', 'examine', 'help.*pod', 'help.*service'
        ]
        
        # Check for complex patterns first (they take priority)
        for pattern in complex_patterns:
            if re.search(pattern, user_message_lower):
                return False
        
        # Check for simple patterns
        for pattern in simple_patterns:
            if re.search(pattern, user_message_lower):
                return True
        
        # Default to complex if unsure
        return False

    def suggest_commands(self, user_question: str, conversation_history: List[Dict[str, Any]] = None) -> List[str]:
        """
        Ask the model to suggest appropriate kubectl commands based on the user's question
        
        Args:
            user_question: The user's natural language question
            conversation_history: Previous conversation context
            
        Returns:
            List of suggested kubectl commands, or empty list if no commands are needed
        """
        try:
            # Check if this is a simple listing question
            is_simple = self._is_simple_listing_question(user_question)
            
            system_prompt = f"""You are a Kubernetes command suggestion expert. Based on the user's question, determine if they need kubectl commands executed.

USER QUESTION TYPE: {'SIMPLE LISTING' if is_simple else 'COMPLEX INVESTIGATION'}

CRITICAL INSTRUCTION: Your response must be ONLY a valid JSON array. Nothing else!

IMPORTANT: NEVER use placeholders like <pod-name>, <namespace-name>, or <service-name> in your commands. Instead, follow the DISCOVERY-FIRST approach:

DISCOVERY-FIRST APPROACH:
1. If the user asks about specific resources but doesn't provide exact names, FIRST suggest discovery commands
2. Only suggest specific resource commands AFTER discovery commands or if the user provided exact names
3. Always use real resource names, never placeholders
4. Be CONSERVATIVE - don't over-suggest commands

SIMPLE QUESTION RULES:
- For simple listing questions, suggest ONLY the basic discovery command
- Examples: "what pods in default" → ["kubectl get pods -n default"]

COMPLEX QUESTION RULES:
- For complex investigation questions, you can suggest follow-up commands
- Examples: "what's wrong with pods" → ["kubectl get pods", "kubectl describe pod <name>"]

EXAMPLES:
- User: "what pods are in my default ns" → ["kubectl get pods -n default"]
- User: "show me services" → ["kubectl get services --all-namespaces"]
- User: "list deployments" → ["kubectl get deployments --all-namespaces"]
- User: "what's wrong with pod my-app-pod?" → ["kubectl describe pod my-app-pod", "kubectl logs my-app-pod"]
- User: "investigate deployment issues" → ["kubectl get deployments --all-namespaces"]

SCENARIOS WHERE COMMANDS ARE NEEDED (return JSON array with commands):
- User asks about specific cluster state: "what pods are running?", "show me deployments", "check cluster health", "how many namespaces do I have?"
- User asks to investigate issues: "why is my pod failing?", "investigate deployment problems", "check service status"
- User asks for specific resource information: "describe pod X", "show logs for pod Y", "get all services", "list namespaces"

SCENARIOS WHERE NO COMMANDS ARE NEEDED (return empty array []):
- User asks for general advice: "should I use config maps or secrets?", "best practices for Kubernetes", "how do I design my application"
- User asks for conceptual explanations: "what is a service mesh?", "explain ingress controllers", "how does Helm work"
- User asks for opinions/recommendations: "which database should I use?", "is this architecture good?", "should I use namespaces"
- User asks for general Kubernetes knowledge: "how do I get started with K8s?", "what are the benefits of Kubernetes?"

COMMAND RULES:
1. If commands are needed, ONLY suggest read-only commands (get, describe, logs, explain, top, auth, api-versions, cluster-info, version, config, view, help)
2. NEVER suggest commands that modify the cluster (create, delete, apply, edit, patch, replace, scale, rollout, exec, attach, port-forward, proxy, cp, auth reconcile, certificate, drain, cordon, taint)
3. NEVER use placeholders like <pod-name>, <namespace-name>, <service-name>
4. Use discovery commands first when exact resource names aren't provided
5. Use appropriate output formats (-o wide, -o json, -o yaml, etc.) when helpful
6. Prioritize the most relevant commands first
7. If no commands are needed, return an empty array []

SAFE COMMAND EXAMPLES:
- "kubectl get pods"
- "kubectl get pods -n default"
- "kubectl describe pod my-app-pod"  # Only if user provided "my-app-pod"
- "kubectl logs my-pod-name"  # Only if user provided "my-pod-name"
- "kubectl get deployments -o wide"
- "kubectl cluster-info"
- "kubectl get nodes"
- "kubectl get services --all-namespaces"
- "kubectl get events -n my-namespace"
- "kubectl get namespaces"

DISCOVERY-FIRST EXAMPLES:
- User: "check the pod I mentioned earlier" → ["kubectl get pods --all-namespaces"]
- User: "what services do I have?" → ["kubectl get services --all-namespaces"]
- User: "investigate the code pod in default" → ["kubectl get pods -n default"]  # Let system find "code" pod
- User: "show me deployment issues" → ["kubectl get deployments --all-namespaces"]

UNSAFE COMMANDS (NEVER SUGGEST):
- kubectl create, delete, apply, edit, patch, replace, scale, rollout, exec, attach, port-forward, proxy, cp
- kubectl auth reconcile, certificate approve/deny/revoke
- kubectl drain, cordon, taint
- Any command with shell operators like |, ;, &&, ||, >, >>, <, $(), `
- Any command with placeholders like <pod-name>, <namespace-name>, <service-name>

RESPONSE FORMAT:
IF COMMANDS NEEDED: ["kubectl get pods", "kubectl describe pod my-pod"]
IF NO COMMANDS NEEDED: []

IMPORTANT: Return ONLY the JSON array. No explanations, no markdown, no code blocks, no additional text. Just the JSON array."""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_question}
            ]
            
            # Add conversation context if available
            if conversation_history:
                # Add conversation history as separate messages for proper context
                recent_history = conversation_history[-5:] if len(conversation_history) > 5 else conversation_history
                for msg in recent_history:
                    role = msg.get('role', 'unknown')
                    content = msg.get('message', '')
                    if role == 'user':
                        messages.append({"role": "user", "content": content})
                    elif role == 'assistant':
                        messages.append({"role": "assistant", "content": content})
            
            # Prepare request payload
            payload = {
                "model": self.model,
                "max_tokens": 500,
                "messages": messages,
                "temperature": 0.3  # Lower temperature for more consistent command suggestions
            }
            
            logger.info(f"Requesting command suggestions for question: {user_question}")
            
            # Make API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content'].strip()
                
                # Parse the response as JSON
                try:
                    commands = json.loads(content)
                    if isinstance(commands, list):
                        # Validate and clean commands
                        clean_commands = []
                        for cmd in commands:
                            if isinstance(cmd, str) and cmd.strip().startswith('kubectl'):
                                clean_commands.append(cmd.strip())
                        
                        logger.info(f"Suggested commands: {clean_commands}")
                        return clean_commands[:5]  # Limit to 5 commands max
                    else:
                        logger.warning(f"Model returned non-list response: {content}")
                        return []
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse command suggestions as JSON: {content}")
                    return []
            else:
                logger.error(f"OpenRouter API error for command suggestions: {response.status_code} - {response.text}")
                return []
                
        except requests.exceptions.Timeout:
            logger.error("Command suggestion request timed out")
            return []
        except Exception as e:
            logger.error(f"Error suggesting commands: {str(e)}")
            return []

    def suggest_follow_up_commands(self, original_question: str, discovery_outputs: Dict[str, Dict[str, Any]], 
                               conversation_history: List[Dict[str, Any]] = None) -> List[str]:
        """
        Suggest follow-up commands based on discovery command outputs
        
        Args:
            original_question: The user's original question
            discovery_outputs: Outputs from discovery commands (like kubectl get pods)
            conversation_history: Previous conversation context
            
        Returns:
            List of follow-up kubectl commands, or empty list if no follow-up needed
        """
        try:
            # Check if this is a simple listing question (no follow-up needed)
            is_simple = self._is_simple_listing_question(original_question)
            if is_simple:
                logger.info("Simple listing question detected - no follow-up commands needed")
                return []
            
            system_prompt = f"""You are a Kubernetes follow-up command expert. Based on the user's original question and the discovery command outputs, determine if follow-up commands are NEEDED and appropriate.

USER QUESTION TYPE: {'SIMPLE LISTING' if is_simple else 'COMPLEX INVESTIGATION'}

CRITICAL INSTRUCTION: Your response must be ONLY a valid JSON array. Nothing else!

IMPORTANT: Be VERY CONSERVATIVE with follow-up commands. Only suggest them when:
1. User explicitly asks for investigation: "what's wrong", "why failing", "investigate", "check issues"
2. Discovery outputs show ACTUAL PROBLEMS (Error, CrashLoopBackOff, ImagePullBackOff, Pending > 5min, etc.)
3. User asks for specific details: "show logs", "check status", "tell me more about"

NEVER suggest follow-up commands for simple listing questions like:
- "what pods are running"
- "show me deployments" 
- "list services"
- "what's in namespace X"
- "what pods are in my default ns"

PROBLEM DETECTION RULES:
Only suggest follow-up if you see ACTUAL problems in discovery outputs:
- Pods with status: Error, CrashLoopBackOff, ImagePullBackOff, Pending, ContainerCreating, Terminating
- Services stuck in Pending for LoadBalancer
- Deployments with failed rollouts or unavailable replicas
- Events showing errors, warnings, or failures
- Anything that's clearly not working properly

DO NOT investigate just because:
- Pod has restarts (might be normal)
- Service is ClusterIP (that's normal)
- Deployment is progressing normally
- Everything looks healthy

RULES:
1. Use ONLY the actual resource names found in the discovery outputs
2. NEVER use placeholders like <pod-name>, <namespace-name>, or <service-name>
3. Only suggest read-only commands (get, describe, logs, explain, top, auth, api-versions, cluster-info, version, config, view, help)
4. Extract real resource names from the JSON outputs provided
5. Limit to maximum 2 follow-up commands
6. If no actual problems found, return empty array []
7. If user just wants a list, return empty array []

FOLLOW-UP NEEDED EXAMPLES:
- User: "what's wrong with my pods?" + discovery shows Error/CrashLoopBackOff → ["kubectl describe pod error-pod", "kubectl logs error-pod"]
- User: "investigate service issues" + discovery shows Pending LoadBalancer → ["kubectl describe service pending-svc"]
- User: "check deployment problems" + discovery shows failed rollout → ["kubectl describe deployment failed-deploy"]

NO FOLLOW-UP NEEDED EXAMPLES:
- User: "what pods are in my default ns" + discovery shows healthy pods → []
- User: "show me services" + discovery shows normal services → []
- User: "list deployments" + discovery shows running deployments → []
- User: "what's in default namespace" + discovery shows healthy resources → []

NO FOLLOW-UP NEEDED EXAMPLES:
- User: "what pods are running?" + discovery shows pods → []
- User: "show me deployments" + discovery shows deployments → []
- User: "list all services" + discovery shows services → []
- User: "what's in default namespace?" + discovery shows resources → []
- User: "what pods are in my default ns" + discovery shows pods → []

RESPONSE FORMAT:
IF FOLLOW-UP NEEDED: ["kubectl describe pod actual-pod-name", "kubectl logs actual-pod-name"]
IF NO FOLLOW-UP NEEDED: []

IMPORTANT: Return ONLY the JSON array. No explanations, no markdown, no code blocks, no additional text. Just the JSON array."""

            # Extract relevant information from discovery outputs
            discovery_summary = ""
            for cmd, output in discovery_outputs.items():
                if output.get('success') and output.get('stdout'):
                    discovery_summary += f"\nCommand: {cmd}\nOutput: {output['stdout'][:1000]}...\n"
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Original question: {original_question}\n\nDiscovery outputs:{discovery_summary}"}
            ]
            
            # Add conversation context if available
            if conversation_history:
                # Add conversation history as separate messages for proper context
                recent_history = conversation_history[-5:] if len(conversation_history) > 5 else conversation_history
                for msg in recent_history:
                    role = msg.get('role', 'unknown')
                    content = msg.get('message', '')
                    if role == 'user':
                        messages.append({"role": "user", "content": content})
                    elif role == 'assistant':
                        messages.append({"role": "assistant", "content": content})
            
            # Prepare request payload
            payload = {
                "model": self.model,
                "max_tokens": 300,
                "messages": messages,
                "temperature": 0.2  # Lower temperature for more consistent follow-up commands
            }
            
            logger.info(f"Requesting follow-up commands for question: {original_question}")
            
            # Make API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content'].strip()
                
                # Parse the response as JSON
                try:
                    commands = json.loads(content)
                    if isinstance(commands, list):
                        # Validate and clean commands
                        clean_commands = []
                        for cmd in commands:
                            if isinstance(cmd, str) and cmd.strip().startswith('kubectl'):
                                clean_commands.append(cmd.strip())
                        
                        logger.info(f"Suggested follow-up commands: {clean_commands}")
                        return clean_commands[:2]  # Limit to 2 commands max (reduced from 3)
                    else:
                        logger.warning(f"Model returned non-list follow-up response: {content}")
                        return []
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse follow-up commands as JSON: {content}")
                    return []
            else:
                logger.error(f"OpenRouter API error for follow-up commands: {response.status_code} - {response.text}")
                return []
                
        except requests.exceptions.Timeout:
            logger.error("Follow-up command suggestion request timed out")
            return []
        except Exception as e:
            logger.error(f"Error suggesting follow-up commands: {str(e)}")
            return []

    def classify_question(self, prompt: str) -> str:
        """
        Use AI to classify question complexity and strategy
        
        Args:
            prompt: Classification prompt built by the classifier
            
        Returns:
            AI response with classification information
        """
        try:
            messages = [
                {"role": "system", "content": "You are a question classification expert. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ]
            
            # Prepare request payload
            payload = {
                "model": self.model,
                "max_tokens": 300,
                "messages": messages,
                "temperature": 0.2  # Low temperature for consistent classification
            }
            
            logger.info("Requesting AI question classification")
            
            # Make API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content'].strip()
                logger.info(f"AI classification response: {content}")
                return content
            else:
                logger.error(f"OpenRouter API error for classification: {response.status_code} - {response.text}")
                return self._get_fallback_classification_response()
                
        except requests.exceptions.Timeout:
            logger.error("Classification request timed out")
            return self._get_fallback_classification_response()
        except Exception as e:
            logger.error(f"Error classifying question: {str(e)}")
            return self._get_fallback_classification_response()
    
    def _get_fallback_classification_response(self) -> str:
        """Get fallback classification response when AI fails"""
        return """{
    "complexity_score": 0.5,
    "question_type": "moderate_investigation",
    "confidence": 0.3,
    "reasoning": "Fallback classification due to AI error",
    "suggested_max_commands": 2,
    "follow_up_allowed": true,
    "response_style": "detailed"
}"""

    def analyze_command_outputs(self, user_question: str, command_outputs: Dict[str, Dict[str, Any]], 
                               conversation_history: List[Dict[str, Any]] = None) -> str:
        """
        Analyze command outputs and generate a user-friendly response
        Uses the new casual, context-aware approach
        
        Args:
            user_question: Original user question
            command_outputs: Dictionary of command -> output mappings (can be empty for advice)
            conversation_history: Previous conversation context
            
        Returns:
            User-friendly analysis response
        """
        try:
            if not command_outputs:
                # This is an advice-only question, no commands were executed
                system_prompt = """You are a friendly Kubernetes assistant. Be casual and conversational.

If someone asks for general advice about Kubernetes, help them out. But if they're asking about specific cluster state, tell them you need to connect to their cluster to see real data.

Keep it simple and helpful. No need for fancy formatting unless there's actually a problem to solve.

Use casual language like "Hey!", "Looks like", "Oh, interesting" when appropriate."""

                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Question: {user_question}"}
                ]
                
                # Add conversation context if available
                if conversation_history:
                    # Add conversation history as separate messages for proper context
                    recent_history = conversation_history[-5:] if len(conversation_history) > 5 else conversation_history
                    for msg in recent_history:
                        role = msg.get('role', 'unknown')
                        content = msg.get('message', '')
                        if role == 'user':
                            messages.append({"role": "user", "content": content})
                        elif role == 'assistant':
                            messages.append({"role": "assistant", "content": content})
                
                # Prepare request payload
                payload = {
                    "model": self.model,
                    "max_tokens": 1500,
                    "messages": messages,
                    "temperature": 0.7
                }
                
                logger.info(f"Generating advice response for question: {user_question}")
                
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
                    logger.info("Successfully generated advice response")
                    return content
                else:
                    logger.error(f"OpenRouter API error for advice: {response.status_code} - {response.text}")
                    return self._generate_advice_fallback(user_question)
            else:
                # Original command analysis logic - using NEW casual approach
                is_simple = self._is_simple_listing_question(user_question)
                
                system_prompt = f"""You are a friendly Kubernetes assistant that talks like a helpful coworker. Be casual and conversational.

USER QUESTION TYPE: {'SIMPLE LISTING' if is_simple else 'COMPLEX INVESTIGATION'}

RESPONSE STYLE RULES:
1. Match your response style to the question complexity
2. Simple questions get simple, direct answers - NO automatic investigation
3. Complex questions get investigation when user explicitly asks for it
4. Use casual language like "Hey!", "Looks like", "Oh, interesting"
5. NO need for summaries, next steps, or follow-ups unless there's a real problem

SIMPLE QUESTION HANDLING:
- Just give them what they asked for directly - tables are great for this
- If everything looks good, just say "All good!" or "Everything looks normal"
- If you see problems, mention them casually but DON'T auto-investigate
- Instead, DETECT problems first, then ASK PERMISSION to investigate
- Example: "Got 5 pods here. Oh, interesting - one is stuck in ImagePullBackOff. Do you want me to investigate what's wrong with it?"
- DO NOT run describe/logs unless user explicitly asks "what's wrong" or says "yes" to investigate

COMPLEX QUESTION HANDLING:
- Investigate problems and provide insights
- Point out issues and suggest what to look at
- Use describe/logs for problem analysis
- Example: User asks "what's wrong with broken-pod" → investigate and suggest commands

COMPLEX QUESTION HANDLING:
- Investigate problems and provide insights
- Point out issues and suggest what to look at
- Use describe/logs for problem analysis
- Example: User asks "what's wrong with broken-pod" → investigate and suggest commands

DATA HANDLING:
- Use the actual command outputs provided
- Be honest about what you can see vs. what you're suggesting
- If commands failed, explain the error
- Format clearly for the user"""

                # Format command outputs for the model
                formatted_outputs = []
                for cmd, output in command_outputs.items():
                    success = output.get('success', False)
                    stdout = output.get('stdout', '')
                    stderr = output.get('stderr', '')
                    
                    formatted_output = f"""
Command: {cmd}
Status: {'SUCCESS' if success else 'FAILED'}
"""
                    
                    if success and stdout:
                        # Limit output length to avoid context overflow
                        if len(stdout) > 1000:
                            formatted_output += f"Output (truncated):\n{stdout[:1000]}...\n"
                        else:
                            formatted_output += f"Output:\n{stdout}\n"
                    
                    if stderr:
                        if len(stderr) > 500:
                            formatted_output += f"Error (truncated):\n{stderr[:500]}...\n"
                        else:
                            formatted_output += f"Error:\n{stderr}\n"
                    
                    formatted_outputs.append(formatted_output)
                
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Question: {user_question}\n\nCommand Outputs:\n" + "\n".join(formatted_outputs)}
                ]
                
                # Add conversation context if available
                if conversation_history:
                    # Add conversation history as separate messages for proper context
                    recent_history = conversation_history[-5:] if len(conversation_history) > 5 else conversation_history
                    for msg in recent_history:
                        role = msg.get('role', 'unknown')
                        content = msg.get('message', '')
                        if role == 'user':
                            messages.append({"role": "user", "content": content})
                        elif role == 'assistant':
                            messages.append({"role": "assistant", "content": content})
                
                # Prepare request payload
                payload = {
                    "model": self.model,
                    "max_tokens": 1500,
                    "messages": messages,
                    "temperature": 0.7
                }
                
                logger.info(f"Analyzing command outputs for question: {user_question}")
                
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
                    logger.info("Successfully generated analysis from command outputs")
                    return content
                else:
                    logger.error(f"OpenRouter API error for analysis: {response.status_code} - {response.text}")
                    return self._generate_analysis_fallback(user_question, command_outputs)
                
        except requests.exceptions.Timeout:
            logger.error("Analysis request timed out")
            return self._generate_analysis_fallback(user_question, command_outputs)
        except Exception as e:
            logger.error(f"Error analyzing command outputs: {str(e)}")
            return self._generate_analysis_fallback(user_question, command_outputs)

    def _generate_advice_fallback(self, user_question: str) -> str:
        """Generate fallback response when advice API is unavailable"""
        
        response = f"I'm having trouble connecting to my advice service right now. For your question '{user_question}', here's some general guidance:\n\n"
        
        # Provide basic advice based on common question patterns
        if 'config map' in user_question.lower() or 'secret' in user_question.lower():
            response += """**ConfigMaps vs Secrets:**

**Use ConfigMaps for:**
- Non-sensitive configuration data
- Application settings
- Feature flags
- Configuration files

**Use Secrets for:**
- Sensitive data (passwords, API keys, tokens)
- Confidential information
- Anything that shouldn't be visible in plain text

**Best Practices:**
- Secrets are base64 encoded, not encrypted
- Use external secret management for production
- Consider using Helm charts or Kustomize for configuration management"""
        
        elif 'best practice' in user_question.lower() or 'design' in user_question.lower():
            response += """**Kubernetes Best Practices:**

**Application Design:**
- Use namespaces to separate environments
- Implement proper resource limits and requests
- Use liveness and readiness probes
- Follow the 12-factor app methodology

**Security:**
- Use RBAC for access control
- Run containers as non-root users
- Use network policies
- Regularly update base images"""
        
        elif 'database' in user_question.lower() or 'storage' in user_question.lower():
            response += """**Database & Storage in Kubernetes:**

**Options:**
- **StatefulSets**: For databases that need stable storage
- **PersistentVolumes**: For persistent data storage
- **Cloud-managed databases**: RDS, Cloud SQL, etc.
- **Operators**: For complex database management

**Considerations:**
- Backup strategies
- High availability
- Performance requirements
- Cost implications"""
        
        else:
            response += """**General Kubernetes Advice:**

Kubernetes is a powerful container orchestration platform. For specific guidance, consider:

- Official Kubernetes documentation
- Your cloud provider's best practices
- Community forums and Stack Overflow
- Consulting with Kubernetes experts

Please try again in a moment for more specific advice."""
        
        return response

    def _generate_analysis_fallback(self, user_question: str, command_outputs: Dict[str, Dict[str, Any]]) -> str:
        """Generate fallback response when analysis API is unavailable"""
        
        # Check if any commands succeeded
        successful_commands = [cmd for cmd, output in command_outputs.items() if output.get('success')]
        failed_commands = [cmd for cmd, output in command_outputs.items() if not output.get('success')]
        
        if successful_commands:
            response = f"I was able to execute some commands to help with your question: '{user_question}'\n\n"
            response += "**Commands executed successfully:**\n"
            for cmd in successful_commands:
                response += f"- {cmd}\n"
            
            if failed_commands:
                response += "\n**Commands that failed:**\n"
                for cmd in failed_commands:
                    error = command_outputs[cmd].get('stderr', 'Unknown error')
                    response += f"- {cmd} (Error: {error[:100]}...)\n"
            
            response += "\n**To get the full analysis, you can run these commands manually and examine their output.**"
            return response
        else:
            response = f"I'm having trouble connecting to my analysis service right now. For your question '{user_question}', here are some commands you can run manually:\n\n"
            
            # Suggest basic commands based on the question
            if 'pod' in user_question.lower():
                response += "```bash\nkubectl get pods\nkubectl describe pod <pod-name>\n```\n"
            elif 'deployment' in user_question.lower():
                response += "```bash\nkubectl get deployments\nkubectl describe deployment <deployment-name>\n```\n"
            elif 'service' in user_question.lower():
                response += "```bash\nkubectl get services\nkubectl describe service <service-name>\n```\n"
            elif 'namespace' in user_question.lower():
                response += "```bash\nkubectl get namespaces\nkubectl get pods -n <namespace>\n```\n"
            else:
                response += "```bash\nkubectl cluster-info\nkubectl get nodes\nkubectl get pods --all-namespaces\n```\n"
            
            response += "\nPlease try again in a moment for automated analysis."
            return response