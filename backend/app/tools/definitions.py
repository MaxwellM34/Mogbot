"""Anthropic tool definitions for Mogbot's 14 tools."""

TOOLS: list[dict] = [
    # -- Browser Tools --
    {
        "name": "browser_navigate",
        "description": "Navigate the browser to a URL.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to navigate to"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "browser_click",
        "description": (
            "Click an element on the page by CSS selector or text content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS selector or text to click",
                },
                "method": {
                    "type": "string",
                    "enum": ["css", "text"],
                    "default": "css",
                    "description": "Selection method: css selector or text match",
                },
            },
            "required": ["selector"],
        },
    },
    {
        "name": "browser_type",
        "description": "Type text into a focused or selected input field.",
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS selector of the input",
                },
                "text": {"type": "string", "description": "Text to type"},
                "press_enter": {
                    "type": "boolean",
                    "default": False,
                    "description": "Whether to press Enter after typing",
                },
            },
            "required": ["selector", "text"],
        },
    },
    {
        "name": "browser_scroll",
        "description": "Scroll the page up or down.",
        "input_schema": {
            "type": "object",
            "properties": {
                "direction": {
                    "type": "string",
                    "enum": ["up", "down"],
                    "description": "Scroll direction",
                },
                "amount": {
                    "type": "integer",
                    "default": 500,
                    "description": "Pixels to scroll",
                },
            },
            "required": ["direction"],
        },
    },
    {
        "name": "browser_screenshot",
        "description": (
            "Take a screenshot of the current page. "
            "Use this to see what's on screen."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "full_page": {
                    "type": "boolean",
                    "default": False,
                    "description": "Capture the full scrollable page",
                },
            },
        },
    },
    {
        "name": "browser_read_page",
        "description": (
            "Extract the text content and interactive elements "
            "from the current page."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "include_links": {
                    "type": "boolean",
                    "default": True,
                    "description": "Include page links in output",
                },
                "include_inputs": {
                    "type": "boolean",
                    "default": True,
                    "description": "Include form inputs in output",
                },
            },
        },
    },
    {
        "name": "browser_select",
        "description": "Select an option from a dropdown.",
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS selector of the select element",
                },
                "value": {
                    "type": "string",
                    "description": "Value to select",
                },
            },
            "required": ["selector", "value"],
        },
    },
    {
        "name": "browser_back",
        "description": "Go back to the previous page.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    # -- Code Execution --
    {
        "name": "execute_code",
        "description": (
            "Execute code in a sandboxed environment. "
            "Supports Python, bash, and JavaScript."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "language": {
                    "type": "string",
                    "enum": ["python", "bash", "javascript"],
                    "description": "Programming language to execute",
                },
                "code": {"type": "string", "description": "Code to execute"},
                "timeout_seconds": {
                    "type": "integer",
                    "default": 30,
                    "description": "Execution timeout in seconds",
                },
            },
            "required": ["language", "code"],
        },
    },
    # -- File Tools --
    {
        "name": "file_read",
        "description": "Read a file from the workspace.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file (relative to workspace)",
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "file_write",
        "description": "Write content to a file in the workspace.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file (relative to workspace)",
                },
                "content": {
                    "type": "string",
                    "description": "Content to write",
                },
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "file_list",
        "description": "List files in a directory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "default": ".",
                    "description": "Directory path (relative to workspace)",
                },
            },
        },
    },
    # -- Human-in-the-Loop --
    {
        "name": "ask_human",
        "description": (
            "Ask the human user for help. Use when you encounter CAPTCHAs, "
            "2FA codes, login prompts, ambiguous decisions, or anything "
            "requiring human judgment. The agent will pause and wait for "
            "the human to respond."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "What you need from the human",
                },
                "type": {
                    "type": "string",
                    "enum": ["captcha", "login", "2fa", "decision", "other"],
                    "description": "Type of human interaction needed",
                },
                "context": {
                    "type": "string",
                    "default": "",
                    "description": "Why you need help",
                },
                "show_browser": {
                    "type": "boolean",
                    "default": True,
                    "description": "Whether to show the browser window to the human",
                },
            },
            "required": ["question", "type"],
        },
    },
    {
        "name": "task_complete",
        "description": (
            "Signal that the task is complete and provide the final result."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "result": {
                    "type": "string",
                    "description": "Summary of what was accomplished",
                },
                "files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": [],
                    "description": "List of files created/modified",
                },
            },
            "required": ["result"],
        },
    },
]
