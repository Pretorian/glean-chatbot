#!/bin/bash
# Setup script for Glean RAG Chatbot
# Fixes ModuleNotFoundError by creating venv and installing dependencies

set -e  # Exit on error

echo "================================"
echo "Glean RAG Chatbot - Setup Script"
echo "================================"
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed or not in PATH"
    exit 1
fi

echo "Python version: $(python3 --version)"
echo ""

# Create virtual environment
if [ -d ".venv" ]; then
    echo "Virtual environment already exists at .venv/"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing existing virtual environment..."
        rm -rf .venv
        echo "Creating new virtual environment..."
        python3 -m venv .venv
    fi
else
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

echo ""
echo "Installing dependencies from requirements.txt..."
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo ""
echo "Verifying mcp package installation..."
if .venv/bin/python -c "import mcp" 2>/dev/null; then
    MCP_VERSION=$(.venv/bin/pip show mcp | grep Version | cut -d' ' -f2)
    echo "✓ mcp package installed successfully (version $MCP_VERSION)"
else
    echo "✗ Failed to install mcp package"
    exit 1
fi

echo ""
echo "================================"
echo "Setup completed successfully!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Activate the virtual environment:"
echo "   source .venv/bin/activate"
echo ""
echo "2. Configure your .env file with Glean tokens"
echo "   cp .env.example .env"
echo "   # Then edit .env and add your tokens"
echo ""
echo "3. Run the smoke test:"
echo "   python -m scripts.smoke_test"
echo ""
echo "4. Index the corpus:"
echo "   python -m src.indexer"
echo ""
echo "5. Test the MCP server:"
echo "   python -m src.mcp_server --test \"What is our remote work policy?\""
echo ""
