export const TOOLS = [
  // -- Browser Tools --
  {
    name: "browser_navigate",
    description: "Navigate the browser to a URL",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL to navigate to" }
      },
      required: ["url"]
    }
  },
  {
    name: "browser_click",
    description: "Click an element on the page by CSS selector or text content",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "CSS selector or text to click" },
        method: { type: "string", enum: ["css", "text"], default: "css" }
      },
      required: ["selector"]
    }
  },
  {
    name: "browser_type",
    description: "Type text into a focused or selected input field",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "CSS selector of the input" },
        text: { type: "string", description: "Text to type" },
        press_enter: { type: "boolean", default: false }
      },
      required: ["selector", "text"]
    }
  },
  {
    name: "browser_scroll",
    description: "Scroll the page up or down",
    input_schema: {
      type: "object" as const,
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
        amount: { type: "number", default: 500 }
      },
      required: ["direction"]
    }
  },
  {
    name: "browser_screenshot",
    description:
      "Take a screenshot of the current page. Use this to see what's on screen.",
    input_schema: {
      type: "object" as const,
      properties: {
        full_page: { type: "boolean", default: false }
      }
    }
  },
  {
    name: "browser_read_page",
    description:
      "Extract the text content and interactive elements from the current page",
    input_schema: {
      type: "object" as const,
      properties: {
        include_links: { type: "boolean", default: true },
        include_inputs: { type: "boolean", default: true }
      }
    }
  },
  {
    name: "browser_select",
    description: "Select an option from a dropdown",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: { type: "string" },
        value: { type: "string" }
      },
      required: ["selector", "value"]
    }
  },
  {
    name: "browser_back",
    description: "Go back to the previous page",
    input_schema: {
      type: "object" as const,
      properties: {}
    }
  },

  // -- Code Execution --
  {
    name: "execute_code",
    description:
      "Execute code in a sandboxed environment. Supports Python and bash.",
    input_schema: {
      type: "object" as const,
      properties: {
        language: {
          type: "string",
          enum: ["python", "bash", "javascript"]
        },
        code: { type: "string", description: "Code to execute" },
        timeout_seconds: { type: "number", default: 30 }
      },
      required: ["language", "code"]
    }
  },

  // -- File Tools --
  {
    name: "file_read",
    description: "Read a file from the workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" }
      },
      required: ["path"]
    }
  },
  {
    name: "file_write",
    description: "Write content to a file in the workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "file_list",
    description: "List files in a directory",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", default: "." }
      }
    }
  },

  // -- Human-in-the-Loop --
  {
    name: "ask_human",
    description:
      "Ask the human user for help. Use when you encounter CAPTCHAs, 2FA codes, " +
      "login prompts, ambiguous decisions, or anything requiring human judgment. " +
      "The agent will pause and wait for the human to respond.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "What you need from the human"
        },
        context: {
          type: "string",
          description: "Why you need help"
        },
        type: {
          type: "string",
          enum: ["captcha", "login", "2fa", "decision", "other"],
          description: "Type of human interaction needed"
        },
        show_browser: {
          type: "boolean",
          default: true,
          description: "Whether to show the browser window to the human"
        }
      },
      required: ["question", "type"]
    }
  },
  {
    name: "task_complete",
    description: "Signal that the task is complete and provide the final result",
    input_schema: {
      type: "object" as const,
      properties: {
        result: {
          type: "string",
          description: "Summary of what was accomplished"
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "List of files created/modified"
        }
      },
      required: ["result"]
    }
  }
];
