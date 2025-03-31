"""
File agent package - Contains modules for file analysis intent recognition and processing
"""

# Import key components for easier access
from agent.file_agent.file_agent import FileAgent
from agent.file_agent.file_intent import create_file_intent_chain, parse_intent_response
from agent.file_agent.file_agent_middleware import FileAgentMiddleware, get_file_agent

__all__ = ['FileAgent', 'FileAgentMiddleware', 'get_file_agent', 'create_file_intent_chain', 'parse_intent_response']