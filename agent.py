from dotenv import load_dotenv
import anthropic

load_dotenv()

client = anthropic.Anthropic()

conversation = []

while True:
    message = input("Enter your prompt: ")
    if message == "exit":
        exit(0)
    if not message:
        continue
    conversation.append({"role":"user" ,"content": message})
    response = client.messages.create(
        max_tokens=1024,
        messages=conversation,
        model="claude-haiku-4-5",
    )
    reply_text = next(block.text for block in response.content if block.type == "text")
    conversation.append({"role":"assistant", "content": reply_text})
    print(reply_text)