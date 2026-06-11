from dotenv import load_dotenv
import openai
import json
import os

load_dotenv()

client = openai.OpenAI()

conversation = []

available_tools = [{
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "Read the contents of a file at the given path",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The file path to read"
                }
            },
            "required": ["path"]
        }
    }
}, 
{
    "type": "function",
    "function": {
        "name": "list_files",
        "description": "List all files in a directory",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The directory path to list"
                }
            },
            "required" : ["path"]
        }
    }
}]

while True:
    try:
        message = input("Enter your prompt: ")
        if message == "exit":
            exit(0)
        if not message:
            continue
        conversation.append({"role": "user", "content": message})
    except EOFError:
        exit(0)
    while True:
        response = client.chat.completions.create(
            max_tokens=1024,
            messages=conversation,
            model="gpt-4o",
            tools=available_tools
        )
        if response.choices[0].finish_reason == "stop":
            reply_text = response.choices[0].message.content
            conversation.append({"role": "assistant", "content": reply_text})
            print(reply_text)
            break
        elif response.choices[0].finish_reason == "tool_calls":
            conversation.append({
                "role": "assistant",
                "content": response.choices[0].message.content,
                "tool_calls": [tc.model_dump() for tc in response.choices[0].message.tool_calls]
            })
            for tool_call in response.choices[0].message.tool_calls:
                if tool_call.function.name == "read_file":
                    args = json.loads(tool_call.function.arguments)
                    try:
                        file_content = open(args["path"]).read()
                    except FileNotFoundError:
                        file_content = f"Error: file not found: {args['path']}"
                    conversation.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": file_content
                    })
                elif tool_call.function.name == "list_files":
                    path = json.loads(tool_call.function.arguments)["path"]
                    try:
                        listed_files = "\n".join(os.listdir(path))
                    except FileNotFoundError:
                        listed_files = f"Error: path not found: {path}"
                    conversation.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": listed_files,
                    })