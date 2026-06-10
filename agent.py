from dotenv import load_dotenv
import openai
import json

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
}]

while True:
    message = input("Enter your prompt: ")
    if message == "exit":
        exit(0)
    if not message:
        continue
    conversation.append({"role": "user", "content": message})
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
    elif response.choices[0].finish_reason == "tool_calls":
        tool_call = response.choices[0].message.tool_calls[0]
        if tool_call.function.name == "read_file":
            args = json.loads(tool_call.function.arguments)
            try:
                file_content = open(args["path"]).read()
            except FileNotFoundError:
                file_content = f"Error: file not found: {args['path']}"
            conversation.append({
                "role": "assistant",
                "content": response.choices[0].message.content,
                "tool_calls": [tc.model_dump() for tc in response.choices[0].message.tool_calls]
            })
            conversation.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": file_content
            })
        tool_result = client.chat.completions.create(
            max_tokens=1024,
            messages=conversation,
            model="gpt-4o",
            tools=available_tools
        )
        reply_text = tool_result.choices[0].message.content
        conversation.append({"role": "assistant", "content": reply_text})
        print(reply_text)
