from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from openai import AsyncOpenAI
import json
import os
import subprocess
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncOpenAI()
conversation: list = []

available_tools = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file at the given path",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "The file path to read"}
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List all files in a directory",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "The directory path to list"}
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "Execute a bash command and return its output",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The bash command to execute"}
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Write content to a file, creating it if it doesn't exist",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "The file path to write to"},
                    "content": {"type": "string", "description": "The full content to write to the file"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": "Search for a pattern in files recursively. Use this to find where a function, variable, or string is defined or used.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "The search pattern (grep-compatible)"},
                    "path": {"type": "string", "description": "Directory or file to search in. Defaults to current directory."},
                },
                "required": ["pattern"],
            },
        },
    },
]


async def run_tool(name: str, args: dict) -> str:
    if name == "read_file":
        try:
            return open(args["path"]).read()
        except FileNotFoundError:
            return f"Error: file not found: {args['path']}"
    elif name == "list_files":
        path = args.get("path", ".")
        try:
            return "\n".join(os.listdir(path))
        except FileNotFoundError:
            return f"Error: path not found: {path}"
    elif name == "bash":
        result = subprocess.run(args["command"], shell=True, capture_output=True, text=True)
        output = result.stdout
        if result.stderr:
            output += "\nSTDERR: " + result.stderr
        return output or "(no output)"
    elif name == "edit_file":
        open(args["path"], "w").write(args["content"])
        return f"Successfully wrote {args['path']}"
    elif name == "search_code":
        pattern = args["pattern"]
        path = args.get("path", ".")
        result = subprocess.run(f"rg -n {pattern} {path}", shell=True, capture_output=True, text=True)
        output = result.stdout
        if result.stderr:
            output += "\nSTDERR: " + result.stderr
        return output or "(no output)"
    return f"Unknown tool: {name}"


async def agent_stream():
    while True:
        stream = await client.chat.completions.create(
            max_tokens=4096,
            messages=conversation,
            model="gpt-4o",
            tools=available_tools,
            stream=True,
        )

        full_content = ""
        tool_calls_map: dict[int, dict] = {}
        finish_reason = None

        async for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            if delta.content:
                full_content += delta.content
                yield {"data": json.dumps({"type": "text", "content": delta.content})}

            if delta.tool_calls:
                for tc_chunk in delta.tool_calls:
                    idx = tc_chunk.index
                    if idx not in tool_calls_map:
                        tool_calls_map[idx] = {"id": "", "name": "", "arguments": ""}
                    if tc_chunk.id:
                        tool_calls_map[idx]["id"] = tc_chunk.id
                    if tc_chunk.function:
                        if tc_chunk.function.name:
                            tool_calls_map[idx]["name"] = tc_chunk.function.name
                        if tc_chunk.function.arguments:
                            tool_calls_map[idx]["arguments"] += tc_chunk.function.arguments

            if choice.finish_reason:
                finish_reason = choice.finish_reason

        if finish_reason == "stop":
            conversation.append({"role": "assistant", "content": full_content})
            yield {"data": json.dumps({"type": "done"})}
            break
        elif finish_reason == "tool_calls":
            tool_calls_list = [
                {
                    "id": tool_calls_map[i]["id"],
                    "type": "function",
                    "function": {
                        "name": tool_calls_map[i]["name"],
                        "arguments": tool_calls_map[i]["arguments"],
                    },
                }
                for i in sorted(tool_calls_map)
            ]
            conversation.append({
                "role": "assistant",
                "content": full_content or None,
                "tool_calls": tool_calls_list,
            })
            for tc in tool_calls_list:
                args = json.loads(tc["function"]["arguments"])
                yield {"data": json.dumps({"type": "tool_call", "name": tc["function"]["name"], "args": args})}
                result = await run_tool(tc["function"]["name"], args)
                yield {"data": json.dumps({"type": "tool_result", "name": tc["function"]["name"], "result": result[:1000]})}
                conversation.append({"role": "tool", "tool_call_id": tc["id"], "content": result})


class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
async def chat(request: ChatRequest):
    conversation.append({"role": "user", "content": request.message})
    return EventSourceResponse(agent_stream())


@app.delete("/conversation")
async def clear_conversation():
    global conversation
    conversation = []
    return {"status": "ok"}
