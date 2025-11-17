import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class QuestionType(Enum):
    SIMPLE_LISTING = "simple_listing"
    MODERATE_INVESTIGATION = "moderate_investigation"
    DEEP_ANALYSIS = "deep_analysis"
    UNKNOWN = "unknown"

class StrategyType(Enum):
    SIMPLE_DISCOVERY = "simple_discovery"
    MODERATE_INVESTIGATION = "moderate_investigation"
    DEEP_ANALYSIS = "deep_analysis"

@dataclass
class ClassificationResult:
    """Result of question classification"""
    question_type: QuestionType
    strategy_type: StrategyType
    complexity_score: float  # 0.0 to 1.0
    confidence: float  # 0.0 to 1.0
    reasoning: str
    suggested_max_commands: int
    follow_up_allowed: bool
    response_style: str  # "concise", "detailed", "comprehensive"
    classification_method: str  # "keyword", "ai", "context", "hybrid"

class HybridQuestionClassifier:
    """Hybrid question classifier combining keyword matching, AI fallback, and context awareness"""
    
    def __init__(self):
        """Initialize the hybrid classifier"""
        self._init_keyword_patterns()
        self._init_context_rules()
        
    def _init_keyword_patterns(self):
        """Initialize keyword-based classification patterns"""
        
        # High-complexity indicators (score: +0.4 to +0.6)
        self.deep_analysis_patterns = {
            'keywords': [
                r'investigate', r'analyze', r'debug', r'troubleshoot',
                r'what\s+wrong\s+with', r'why\s+is\s+\w+\s+(failing|stuck|crashing)',
                r'root\s+cause', r'diagnose', r'examine\s+in\s+detail'
            ],
            'score_impact': 0.6,
            'confidence_boost': 0.3
        }
        
        # Moderate-complexity indicators (score: +0.2 to +0.4)
        self.moderate_investigation_patterns = {
            'keywords': [
                r'check\s+status', r'verify', r'validate',
                r'health\s+check', r'is\s+\w+\s+(running|working|ok)',
                r'problems?\s+with', r'issues?\s+with'
            ],
            'score_impact': 0.3,
            'confidence_boost': 0.2
        }
        
        # Simple-listing indicators (score: -0.3 to -0.1)
        self.simple_listing_patterns = {
            'keywords': [
                r'show\s+me', r'list\s+\w+', r'get\s+\w+',
                r'what\s+(pods|deployments|services|namespaces)',
                r'how\s+many', r'display\s+\w+'
            ],
            'score_impact': -0.2,
            'confidence_boost': 0.2
        }
        
        # Negative complexity indicators (reduce score)
        self.negative_patterns = {
            'keywords': [
                r'quick\s+check', r'brief\s+overview', r'simple\s+list',
                r'just\s+show', r'only\s+list'
            ],
            'score_impact': -0.3,
            'confidence_boost': 0.1
        }
        
        # Resource-specific complexity adjustments
        self.resource_complexity = {
            'pod': 0.1,
            'deployment': 0.15,
            'service': 0.1,
            'namespace': 0.05,
            'cluster': 0.2,
            'node': 0.15,
            'configmap': 0.05,
            'secret': 0.05
        }
    
    def _init_context_rules(self):
        """Initialize context-aware classification rules"""
        
        self.context_rules = {
            'investigation_continuation': {
                'patterns': [r'investigate', r'analyze', r'debug'],
                'window': 3,  # Look at last 3 messages
                'score_boost': 0.3,
                'confidence_boost': 0.2
            },
            'simple_browsing': {
                'patterns': [r'show', r'list', r'get'],
                'window': 2,
                'score_reduction': 0.2,
                'confidence_boost': 0.1
            },
            'problem_followup': {
                'patterns': [r'error', r'fail', r'wrong', r'issue'],
                'window': 4,
                'score_boost': 0.4,
                'confidence_boost': 0.3
            }
        }
    
    def classify_question(self, message: str, conversation_history: List[Dict[str, Any]] = None, 
                          ai_client = None) -> ClassificationResult:
        """
        Classify question using hybrid approach
        
        Args:
            message: User's question
            conversation_history: Previous conversation messages
            ai_client: OpenRouter client for AI fallback
            
        Returns:
            ClassificationResult with detailed classification information
        """
        try:
            # Step 1: Keyword-based classification
            keyword_result = self._classify_by_keywords(message)
            
            # Step 2: Apply context awareness
            context_adjusted_result = self._apply_context_awareness(
                keyword_result, message, conversation_history
            )
            
            # Step 3: Determine if AI fallback is needed
            if context_adjusted_result.confidence < 0.7 and ai_client:
                logger.info(f"Low confidence ({context_adjusted_result.confidence:.2f}) - using AI fallback")
                ai_result = self._classify_with_ai(message, conversation_history, ai_client)
                
                # Combine results with weighted average
                final_result = self._combine_classification_results(
                    context_adjusted_result, ai_result
                )
                final_result.classification_method = "hybrid"
            else:
                final_result = context_adjusted_result
                final_result.classification_method = "keyword_context"
            
            # Step 4: Determine strategy and parameters
            final_result = self._determine_strategy_parameters(final_result)
            
            logger.info(f"Classification complete: {final_result.question_type.value} "
                       f"(score: {final_result.complexity_score:.2f}, "
                       f"confidence: {final_result.confidence:.2f}, "
                       f"method: {final_result.classification_method})")
            
            return final_result
            
        except Exception as e:
            logger.error(f"Error in hybrid classification: {str(e)}")
            # Fallback to simple classification
            return self._get_fallback_classification(message)
    
    def _classify_by_keywords(self, message: str) -> ClassificationResult:
        """Classify question using keyword patterns"""
        
        message_lower = message.lower()
        base_score = 0.5  # Start with neutral score
        confidence = 0.5
        reasoning_parts = []
        
        # Check deep analysis patterns
        for pattern in self.deep_analysis_patterns['keywords']:
            if re.search(pattern, message_lower):
                base_score += self.deep_analysis_patterns['score_impact']
                confidence += self.deep_analysis_patterns['confidence_boost']
                reasoning_parts.append(f"Deep analysis pattern: {pattern}")
        
        # Check moderate investigation patterns
        for pattern in self.moderate_investigation_patterns['keywords']:
            if re.search(pattern, message_lower):
                base_score += self.moderate_investigation_patterns['score_impact']
                confidence += self.moderate_investigation_patterns['confidence_boost']
                reasoning_parts.append(f"Moderate investigation pattern: {pattern}")
        
        # Check simple listing patterns
        for pattern in self.simple_listing_patterns['keywords']:
            if re.search(pattern, message_lower):
                base_score += self.simple_listing_patterns['score_impact']
                confidence += self.simple_listing_patterns['confidence_boost']
                reasoning_parts.append(f"Simple listing pattern: {pattern}")
        
        # Check negative patterns
        for pattern in self.negative_patterns['keywords']:
            if re.search(pattern, message_lower):
                base_score += self.negative_patterns['score_impact']
                confidence += self.negative_patterns['confidence_boost']
                reasoning_parts.append(f"Negative pattern: {pattern}")
        
        # Apply resource-specific complexity adjustments
        for resource, adjustment in self.resource_complexity.items():
            if resource in message_lower:
                base_score += adjustment
                reasoning_parts.append(f"Resource-specific: {resource} (+{adjustment})")
        
        # Clamp values
        base_score = max(0.0, min(1.0, base_score))
        confidence = max(0.1, min(1.0, confidence))
        
        # Determine question type
        if base_score >= 0.7:
            question_type = QuestionType.DEEP_ANALYSIS
        elif base_score >= 0.4:
            question_type = QuestionType.MODERATE_INVESTIGATION
        else:
            question_type = QuestionType.SIMPLE_LISTING
        
        reasoning = "; ".join(reasoning_parts) if reasoning_parts else "No specific patterns detected"
        
        return ClassificationResult(
            question_type=question_type,
            strategy_type=StrategyType.SIMPLE_DISCOVERY,  # Will be adjusted later
            complexity_score=base_score,
            confidence=confidence,
            reasoning=reasoning,
            suggested_max_commands=1,  # Will be adjusted later
            follow_up_allowed=False,  # Will be adjusted later
            response_style="concise",  # Will be adjusted later
            classification_method="keyword"
        )
    
    def _apply_context_awareness(self, result: ClassificationResult, message: str,
                               conversation_history: List[Dict[str, Any]]) -> ClassificationResult:
        """Apply context awareness based on conversation history"""
        
        if not conversation_history:
            return result
        
        # Get recent messages for context
        recent_messages = conversation_history[-5:]  # Last 5 messages
        context_adjustments = []
        
        # Check investigation continuation
        if self._matches_context_pattern(recent_messages, 
                                        self.context_rules['investigation_continuation']):
            result.complexity_score += self.context_rules['investigation_continuation']['score_boost']
            result.confidence += self.context_rules['investigation_continuation']['confidence_boost']
            context_adjustments.append("Investigation continuation detected")
        
        # Check simple browsing pattern
        elif self._matches_context_pattern(recent_messages,
                                          self.context_rules['simple_browsing']):
            result.complexity_score -= self.context_rules['simple_browsing']['score_reduction']
            result.confidence += self.context_rules['simple_browsing']['confidence_boost']
            context_adjustments.append("Simple browsing pattern detected")
        
        # Check problem follow-up
        elif self._matches_context_pattern(recent_messages,
                                          self.context_rules['problem_followup']):
            result.complexity_score += self.context_rules['problem_followup']['score_boost']
            result.confidence += self.context_rules['problem_followup']['confidence_boost']
            context_adjustments.append("Problem follow-up detected")
        
        # Update reasoning with context information
        if context_adjustments:
            result.reasoning += f"; Context: {', '.join(context_adjustments)}"
        
        # Clamp values
        result.complexity_score = max(0.0, min(1.0, result.complexity_score))
        result.confidence = max(0.1, min(1.0, result.confidence))
        
        return result
    
    def _matches_context_pattern(self, messages: List[Dict[str, Any]], 
                                rule: Dict[str, Any]) -> bool:
        """Check if recent messages match a context pattern"""
        
        if len(messages) < rule['window']:
            return False
        
        recent_window = messages[-rule['window']:]
        pattern_count = 0
        
        for msg in recent_window:
            if msg.get('role') == 'user':
                msg_content = msg.get('message', '').lower()
                for pattern in rule['patterns']:
                    if re.search(pattern, msg_content):
                        pattern_count += 1
                        break
        
        # Match if at least half the messages in the window match the pattern
        return pattern_count >= (rule['window'] // 2)
    
    def _classify_with_ai(self, message: str, conversation_history: List[Dict[str, Any]],
                         ai_client) -> ClassificationResult:
        """Use AI to classify the question"""
        
        try:
            # Build AI classification prompt
            prompt = self._build_ai_classification_prompt(message, conversation_history)
            
            # Call AI for classification
            ai_response = ai_client.classify_question(prompt)
            
            # Parse AI response
            return self._parse_ai_classification_response(ai_response)
            
        except Exception as e:
            logger.error(f"AI classification failed: {str(e)}")
            # Return fallback classification
            return self._get_fallback_classification(message)
    
    def _build_ai_classification_prompt(self, message: str, 
                                      conversation_history: List[Dict[str, Any]]) -> str:
        """Build prompt for AI classification"""
        
        context = ""
        if conversation_history:
            recent_history = conversation_history[-3:]  # Last 3 messages
            context_parts = []
            for msg in recent_history:
                role = msg.get('role', 'unknown')
                content = msg.get('message', '')[:100]  # Truncate long messages
                context_parts.append(f"{role}: {content}")
            context = "\nRecent conversation:\n" + "\n".join(context_parts)
        
        prompt = f"""
Classify this Kubernetes question for command execution strategy:

Question: "{message}"
{context}

Return a JSON response with:
{{
    "complexity_score": 0.0-1.0,
    "question_type": "simple_listing|moderate_investigation|deep_analysis",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation",
    "suggested_max_commands": 1-4,
    "follow_up_allowed": true/false,
    "response_style": "concise|detailed|comprehensive"
}}

Guidelines:
- Simple listing (0.0-0.3): "show pods", "list services" - max 1 command, no follow-up
- Moderate investigation (0.4-0.6): "check pod status", "verify deployment" - max 2 commands, follow-up allowed
- Deep analysis (0.7-1.0): "investigate issues", "debug problems" - max 4 commands, follow-up required
"""
        
        return prompt
    
    def _parse_ai_classification_response(self, ai_response: str) -> ClassificationResult:
        """Parse AI classification response"""
        
        try:
            import json
            
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                ai_data = json.loads(json_match.group())
                
                # Map AI response to our types
                question_type_map = {
                    'simple_listing': QuestionType.SIMPLE_LISTING,
                    'moderate_investigation': QuestionType.MODERATE_INVESTIGATION,
                    'deep_analysis': QuestionType.DEEP_ANALYSIS
                }
                
                strategy_type_map = {
                    'simple_listing': StrategyType.SIMPLE_DISCOVERY,
                    'moderate_investigation': StrategyType.MODERATE_INVESTIGATION,
                    'deep_analysis': StrategyType.DEEP_ANALYSIS
                }
                
                return ClassificationResult(
                    question_type=question_type_map.get(ai_data.get('question_type'), QuestionType.UNKNOWN),
                    strategy_type=strategy_type_map.get(ai_data.get('question_type'), StrategyType.SIMPLE_DISCOVERY),
                    complexity_score=float(ai_data.get('complexity_score', 0.5)),
                    confidence=float(ai_data.get('confidence', 0.5)),
                    reasoning=ai_data.get('reasoning', 'AI classification'),
                    suggested_max_commands=int(ai_data.get('suggested_max_commands', 1)),
                    follow_up_allowed=bool(ai_data.get('follow_up_allowed', False)),
                    response_style=ai_data.get('response_style', 'concise'),
                    classification_method="ai"
                )
            
        except Exception as e:
            logger.error(f"Failed to parse AI response: {str(e)}")
        
        # Fallback if parsing fails
        return self._get_fallback_classification("AI parsing failed")
    
    def _combine_classification_results(self, keyword_result: ClassificationResult,
                                      ai_result: ClassificationResult) -> ClassificationResult:
        """Combine keyword and AI classification results"""
        
        # Weight the results (AI gets slightly more weight when available)
        keyword_weight = 0.4
        ai_weight = 0.6
        
        combined_score = (keyword_result.complexity_score * keyword_weight + 
                          ai_result.complexity_score * ai_weight)
        combined_confidence = (keyword_result.confidence * keyword_weight + 
                               ai_result.confidence * ai_weight)
        
        # Use AI's question type if it has higher confidence
        if ai_result.confidence > keyword_result.confidence:
            final_question_type = ai_result.question_type
            final_strategy_type = ai_result.strategy_type
        else:
            final_question_type = keyword_result.question_type
            final_strategy_type = keyword_result.strategy_type
        
        return ClassificationResult(
            question_type=final_question_type,
            strategy_type=final_strategy_type,
            complexity_score=combined_score,
            confidence=combined_confidence,
            reasoning=f"Keyword: {keyword_result.reasoning}; AI: {ai_result.reasoning}",
            suggested_max_commands=max(keyword_result.suggested_max_commands, 
                                     ai_result.suggested_max_commands),
            follow_up_allowed=keyword_result.follow_up_allowed or ai_result.follow_up_allowed,
            response_style=ai_result.response_style if ai_result.confidence > keyword_result.confidence 
                          else keyword_result.response_style,
            classification_method="hybrid"
        )
    
    def _determine_strategy_parameters(self, result: ClassificationResult) -> ClassificationResult:
        """Determine strategy parameters based on classification"""
        
        # Adjust question type based on final complexity score
        if result.complexity_score >= 0.7:
            result.question_type = QuestionType.DEEP_ANALYSIS
            result.strategy_type = StrategyType.DEEP_ANALYSIS
            result.suggested_max_commands = max(3, result.suggested_max_commands)
            result.follow_up_allowed = True
            result.response_style = "comprehensive"
        elif result.complexity_score >= 0.4:
            result.question_type = QuestionType.MODERATE_INVESTIGATION
            result.strategy_type = StrategyType.MODERATE_INVESTIGATION
            result.suggested_max_commands = max(2, result.suggested_max_commands)
            result.follow_up_allowed = True
            result.response_style = "detailed"
        else:
            result.question_type = QuestionType.SIMPLE_LISTING
            result.strategy_type = StrategyType.SIMPLE_DISCOVERY
            result.suggested_max_commands = 1
            result.follow_up_allowed = False
            result.response_style = "concise"
        
        return result
    
    def _get_fallback_classification(self, message: str) -> ClassificationResult:
        """Get fallback classification when all else fails"""
        
        logger.warning(f"Using fallback classification for: {message}")
        
        # Simple keyword-based fallback
        message_lower = message.lower()
        if any(word in message_lower for word in ['wrong', 'error', 'fail', 'investigate']):
            question_type = QuestionType.MODERATE_INVESTIGATION
            strategy_type = StrategyType.MODERATE_INVESTIGATION
            complexity_score = 0.6
            max_commands = 2
            follow_up = True
            style = "detailed"
        else:
            question_type = QuestionType.SIMPLE_LISTING
            strategy_type = StrategyType.SIMPLE_DISCOVERY
            complexity_score = 0.3
            max_commands = 1
            follow_up = False
            style = "concise"
        
        return ClassificationResult(
            question_type=question_type,
            strategy_type=strategy_type,
            complexity_score=complexity_score,
            confidence=0.3,  # Low confidence for fallback
            reasoning="Fallback classification due to error",
            suggested_max_commands=max_commands,
            follow_up_allowed=follow_up,
            response_style=style,
            classification_method="fallback"
        )