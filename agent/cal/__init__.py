"""
Calendar agent package - Contains modules for calendar intent recognition and processing
"""

# Import key components for easier access
from agent.cal.calendar_agent import CalendarAgent
from agent.cal.calendar_intent import create_calendar_intent_chain, parse_intent_response
from agent.cal.calendar_utils import parse_relative_date, parse_time