#!/bin/bash
# Wrapper script to run MCP server with correct Python path

cd /Users/x/work/glean-chatbot
export PYTHONPATH=/Users/x/work/glean-chatbot:$PYTHONPATH
exec .venv/bin/python -m src.mcp_server
