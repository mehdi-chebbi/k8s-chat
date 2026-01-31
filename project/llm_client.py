import requests
import json
import logging
import re
from typing import Dict, List, Any, Optional, Generator
from datetime import datetime
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

def extract_kubectl_commands(content: str) -> list:
    """
    Extract kubectl commands from AI response, handling markdown formatting.
    
    Args:
        content: The AI response text that may contain kubectl commands
        
    Returns:
        List of kubectl commands (max 3)
    """
    commands = []
    
    for line in content.split('\n'):
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
        
        # Remove markdown list markers (-, *, 1., 2., etc.)
        line = re.sub(r'^[-*]\s+', '', line)  # Remove "- " or "* "
        line = re.sub(r'^\d+\.\s+', '', line)  # Remove "1. " or "2. "
        line = line.strip()
        
        # Now check if it's a kubectl command
        if line.startswith('kubectl '):
            commands.append(line)
        elif 'kubectl ' in line:
            # Handle cases like "Run: kubectl get pods"
            # Extract everything from 'kubectl' onwards
            match = re.search(r'kubectl\s+.+', line)
            if match:
                commands.append(match.group(0))
    
    return commands[:3]  # Limit to 3 commands

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

    def analyze_command_outputs_stream(self, user_question: str, command_outputs: Dict[str, Any], 
                                       conversation_history: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """Analyze kubectl command outputs and provide insights - STREAMING VERSION"""
        try:
            # Build a focused prompt for output analysis
            system_prompt = """You are a Kubernetes expert analyzing command outputs to help the user. 

    Your task:
    1. Analyze the provided kubectl command outputs
    2. Identify any issues, problems, or important information
    3. Provide clear, actionable insights
    4. Be conversational and helpful

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
                "max_tokens": 15000,
                "messages": messages,
                "temperature": 0.7,
                "stream": True
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                stream=True,
                timeout=600
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
            
                logger.info("Successfully completed streaming analysis")
            else:
                logger.error(f"API error: {response.status_code} - {response.text}")
                # Fallback to non-streaming
                fallback = self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
                for char in fallback:
                    yield char
            
        except requests.exceptions.Timeout:
            logger.error("API request timed out")
            fallback = self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
            for char in fallback:
                yield char
        except Exception as e:
            logger.error(f"Error in streaming analysis: {str(e)}")
            fallback = self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
            for char in fallback:
                yield char
  
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
                "max_tokens": 20000,
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
                timeout=600
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
                "max_tokens": 20000,
                "messages": messages,
                "temperature": 0.7
            }
            
            logger.info(f"Sending request to OpenRouter with intent: {intent.get('type')}")
            
            # Make API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
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
            system_prompt = """You are a Kubernetes expert. Based on the user's question, suggest the most appropriate kubectl commands to investigate their issue.

CRITICAL RULES:

- Suggest ONLY read-only kubectl commands (get, describe, logs, top, events)

- Focus on specific resources mentioned (pods, deployments, services, nodes, etc.)

- NEVER use placeholders like <pod-name>, <namespace>, <pod> - use real names from the question or generic flags

- Start with general discovery commands (kubectl get pods, kubectl get namespaces, kubectl get deployments)

- Use --all-namespaces or -l flags instead of specific placeholders


- Format as a simple list of commands only, no explanations



Examples:

User: "Why is my nginx pod failing?"

Commands:

- kubectl get pods -l app=nginx

- kubectl get events --field-selector involvedObject.name=<pod-name-from-above>



User: "show me all pods"

Commands:

- kubectl get pods --all-namespaces



User: "what's wrong with my deployments?"

Commands:

- kubectl get deployments --all-namespaces

- kubectl get pods --all-namespaces



NEVER use placeholders! If you don't have a specific pod name, use general commands instead."""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User question: {user_question}"}
            ]
            
            payload = {
                "model": self.model,
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.3
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']

                # Extract commands from the response
                commands = extract_kubectl_commands(content)
                return commands

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
4. Be conversational and helpful

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
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.7
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
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
            system_prompt = """You are a Kubernetes expert. Based on initial investigation results, suggest follow-up commands to dig deeper into any issues found.

CRITICAL RULES:

- Suggest ONLY read-only kubectl commands (get, describe, logs, top, events)

- Focus on investigating problems identified in first round

- NEVER use placeholders like <pod-name>, <namespace>, <pod> - use --all-namespaces or labels from outputs


- Use resource names from the actual command outputs above

- Consider what additional information would be most helpful



Examples:

If pods are failing: kubectl get events, kubectl describe pods

If deployments have issues: kubectl describe deployments, kubectl get replicasets

If resource issues: kubectl describe nodes, kubectl get resourcequotas



NEVER use placeholders! Use actual names from command outputs or general flags."""

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
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.5
            }

            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
            )

            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']

                # Extract commands from the response
                commands = extract_kubectl_commands(content)
                return commands

            return []

        except Exception as e:
            logger.error(f"Error suggesting follow-up commands: {str(e)}")
            return []

    def generate_intelligent_response(self, user_question: str, conversation_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        AI decides whether to respond with chat or suggest kubectl commands.

        This is the main entry point - AI determines:
        1. Is this a greeting/casual question? → Return chat response only
        2. Is this a K8s investigation question? → Suggest appropriate commands

        Args:
            user_question: The user's message
            conversation_history: Previous messages in the conversation

        Returns:
            Dict with:
            {
                "type": "chat" | "investigation",
                "response": "AI's conversational response",
                "commands": ["kubectl get pods"]  // Only for investigation type
            }
        """
        try:
            # Build conversation context
            context = ""
            if conversation_history:
                recent_history = conversation_history[-3:]  # Last 3 messages
                context_parts = []
                for msg in recent_history:
                    role = msg.get('role', 'unknown')
                    content = msg.get('message', '')[:200]  # Truncate long messages
                    context_parts.append(f"{role}: {content}")
                context = "\nRecent conversation:\n" + "\n".join(context_parts)

            # Build smart system prompt that lets AI decide
            system_prompt = f"""You are a Kubernetes expert assistant.

Your task is to understand the user's intent and respond appropriately:

1. **Casual conversation / greetings**: Respond naturally, NO kubectl commands
   - Examples: "hi", "hello", "how are you?", "thanks", "bye"
   - Response: Just chat naturally like a human

2. **Kubernetes questions**: Suggest appropriate read-only kubectl commands
   - Examples: "what's wrong with my namespace?", "show me pods", "check deployment status"
   - Response: Explain what you'll check + suggest commands

CRITICAL RULES FOR COMMANDS:
- ONLY suggest commands for actual Kubernetes questions
- NO commands for greetings, thanks, general chat
- Commands must be read-only only: get, describe, logs, top, events
- NEVER use placeholders like <pod-name>, <namespace>, <pod> - use "--all-namespaces" or generic flags instead
- Start with general discovery commands first (kubectl get pods, kubectl get namespaces)
- Let user provide specific names if they want to focus on particular resources
- NO LIMIT on number of commands - suggest as many as needed for thorough investigation
- Examples of BAD commands: "kubectl describe pod <pod-name>", "kubectl logs <pod> -n <namespace>"
- Examples of GOOD commands: "kubectl get pods --all-namespaces", "kubectl get namespaces"

Return a JSON response with this exact structure:
{{
    "type": "chat" | "investigation",
    "response": "your conversational response to the user",
    "commands": ["kubectl command 1", "kubectl command 2"]  // empty array for chat type
}}

Examples:
User: "hi"
Response: {{"type": "chat", "response": "Hello! How can I help you with your Kubernetes cluster today?", "commands": []}}

User: "what's wrong with my namespace?"
Response: {{"type": "investigation", "response": "Let me check what's happening with your namespace. I'll look at your namespaces and pods.", "commands": ["kubectl get namespaces", "kubectl get pods --all-namespaces"]}}

User: "inspect my nginx pods"
Response: {{"type": "investigation", "response": "I'll check your nginx pods to see what's happening.", "commands": ["kubectl get pods -l app=nginx"]}}

User: "thanks"
Response: {{"type": "chat", "response": "You're welcome! Let me know if you need anything else.", "commands": []}}

User: "show me pods"
Response: {{"type": "investigation", "response": "I'll show you all the pods in your cluster.", "commands": ["kubectl get pods --all-namespaces"]}}

{context}"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User says: {user_question}"}
            ]

            payload = {
                "model": self.model,
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.7
            }

            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
            )

            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']

                # Try to extract JSON from response
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    try:
                        ai_response = json.loads(json_match.group())

                        # Validate the structure
                        response_type = ai_response.get('type', 'chat')
                        response_text = ai_response.get('response', '')
                        commands = ai_response.get('commands', [])

                        # Ensure commands is a list
                        if not isinstance(commands, list):
                            commands = []

                        # Only allow valid types
                        if response_type not in ['chat', 'investigation']:
                            response_type = 'chat'

                        logger.info(f"AI intelligent response: type={response_type}, commands_count={len(commands)}")

                        return {
                            'type': response_type,
                            'response': response_text,
                            'commands': commands
                        }
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse AI JSON response: {content}")
                        # Fallback: treat as chat
                        return {
                            'type': 'chat',
                            'response': content,
                            'commands': []
                        }
                else:
                    # No JSON found, treat entire response as chat
                    logger.warning(f"No JSON in AI response, treating as chat: {content[:100]}")
                    return {
                        'type': 'chat',
                        'response': content,
                        'commands': []
                    }
            else:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                # Return fallback
                return {
                    'type': 'chat',
                    'response': 'I had trouble understanding. Could you please rephrase?',
                    'commands': []
                }

        except Exception as e:
            logger.error(f"Error generating intelligent response: {str(e)}")
            return {
                'type': 'chat',
                'response': 'Something went wrong. Please try again.',
                'commands': []
            }

    def test_connection(self) -> Dict[str, Any]:
        """Test connection to OpenRouter API"""
        try:
            test_payload = {
                "model": self.model,
                "max_tokens": 10000,
                "messages": [{"role": "user", "content": "test"}],
                "temperature": 0.1
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=test_payload,
                timeout=100
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

    def analyze_command_outputs_stream(self, user_question: str, command_outputs: Dict[str, Any], 
                                       conversation_history: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """Analyze kubectl command outputs and provide insights - STREAMING VERSION"""
        try:
            # Build a focused prompt for output analysis
            system_prompt = """You are a Kubernetes expert analyzing command outputs to help the user. 

    Your task:
    1. Analyze the provided kubectl command outputs
    2. Identify any issues, problems, or important information
    3. Provide clear, actionable insights
    4. Be conversational and helpful

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
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.7,
                "stream": True
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                stream=True,
                timeout=600
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
            
                logger.info("Successfully completed streaming analysis")
            else:
                logger.error(f"API error: {response.status_code} - {response.text}")
                # Fallback to non-streaming
                fallback = self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
                for char in fallback:
                    yield char
            
        except requests.exceptions.Timeout:
            logger.error("API request timed out")
            fallback = self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
            for char in fallback:
                yield char
        except Exception as e:
            logger.error(f"Error in streaming analysis: {str(e)}")
            fallback = self._generate_enhanced_fallback_response({'type': 'analysis'}, command_outputs)
            for char in fallback:
                yield char

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
                "max_tokens": 10000,
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
                timeout=600
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
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.7
            }
            
            logger.info(f"Sending request to Local LLM at {self.endpoint_url} with intent: {intent.get('type')}")
            
            # Make API request
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
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
                "max_tokens": 10000,
                "messages": [{"role": "user", "content": "test"}],
                "temperature": 0.1
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=test_payload,
                timeout=100
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

CRITICAL RULES:

- Suggest ONLY read-only kubectl commands (get, describe, logs, top, events)

- Focus on specific resources mentioned (pods, deployments, services, nodes, etc.)

- NEVER use placeholders like <pod-name>, <namespace>, <pod> - use real names from the question or generic flags

- Start with general discovery commands (kubectl get pods, kubectl get namespaces, kubectl get deployments)

- Use --all-namespaces or -l flags instead of specific placeholders


- Format as a simple list of commands only, no explanations



Examples:

User: "Why is my nginx pod failing?"

Commands:

- kubectl get pods -l app=nginx

- kubectl get events --field-selector involvedObject.name=<pod-name-from-above>



User: "show me all pods"

Commands:

- kubectl get pods --all-namespaces



User: "what's wrong with my deployments?"

Commands:

- kubectl get deployments --all-namespaces

- kubectl get pods --all-namespaces



NEVER use placeholders! If you don't have a specific pod name, use general commands instead."""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User question: {user_question}"}
            ]
            
            payload = {
                "model": self.model,
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.3
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']

                # Extract commands from the response
                commands = extract_kubectl_commands(content)
                return commands

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
4. Be conversational and helpful

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
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.7
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
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
            system_prompt = """You are a Kubernetes expert. Based on initial investigation results, suggest follow-up commands to dig deeper into any issues found.

CRITICAL RULES:

- Suggest ONLY read-only kubectl commands (get, describe, logs, top, events)

- Focus on investigating problems identified in first round

- NEVER use placeholders like <pod-name>, <namespace>, <pod> - use --all-namespaces or labels from outputs


- Use resource names from the actual command outputs above

- Consider what additional information would be most helpful



Examples:

If pods are failing: kubectl get events, kubectl describe pods

If deployments have issues: kubectl describe deployments, kubectl get replicasets

If resource issues: kubectl describe nodes, kubectl get resourcequotas



NEVER use placeholders! Use actual names from command outputs or general flags."""

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
                "max_tokens": 10000,
                "messages": messages,
                "temperature": 0.5
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=300
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']

                # Extract commands from the response
                commands = extract_kubectl_commands(content)
                return commands

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