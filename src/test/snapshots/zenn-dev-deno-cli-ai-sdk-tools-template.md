[![](https://storage.googleapis.com/zenn-user-upload/topics/23eef6d9d7.png)

AI](/topics/ai)[![](https://storage.googleapis.com/zenn-user-upload/topics/f13e758fdb.png)

TypeScript](/topics/typescript)[![](https://storage.googleapis.com/zenn-user-upload/topics/c0de7c62a6.png)

Deno](/topics/deno)[![](https://static.zenn.studio/images/drawing/tech-icon.svg)

tech](/tech-or-idea)

Claude or ChatGPT + Tools やモデルの組み合わせで対応パターンが膨大で面倒だったのを、 Deno + ai-sdk(Vercel) で書き直したらだいぶ楽になった。

この辺を参照した。

[https://vercel.com/blog/introducing-the-vercel-ai-sdk](https://vercel.com/blog/introducing-the-vercel-ai-sdk)

[https://zenn.dev/laiso/articles/a6a7b4864a713f](https://zenn.dev/laiso/articles/a6a7b4864a713f)

OpenAI と AnthropicAI の Tools の叩き方を確認したが、 Gemini はそこを省いている。

## 前提

まず、 AI 周りの CLI ツールは専用の面倒臭さがあることを知っておく必要がある。

* ストリーミング
* Tools の応答

AI 周りの応答をストリーミングするのは LLM 関係なくストリーミング処理を大量に書く必要がある。

ストリーミング処理は WebSocket や WebWorker 周りのAPIハンドルと同じノウハウが必要になる。別に難しくはないが、既存の Promise 抽象に当てはまらないので、都度考えることになり、だるい。

Tools の応答は、AI にスキーマと関数を提供しつつ、AI側からの問い合わせをツール毎のルールに従ってレスポンスデータを作る必要がある。これもだるい。

Vercel の `ai`, `@ai-sdk/*` はその辺の処理をラップしている。 Vercel 製だが、クラウドでもローカルでも動く。

というわけで、今までの手癖スクリプトを移植して、今後しばらくのコピペ元として使えるようにした。

## 元々使ってたスクリプト

* Deno
* Claude

```ts
#!/usr/bin/env -S deno run -A
import AnthropicAI from "npm:@anthropic-ai/sdk@0.27.3";
import { parseArgs } from "node:util";

const parsed = parseArgs({
  args: Deno.args,
  allowPositionals: true,
  options: {
    model: {
      type: "string",
      short: "m",
    },
    maxTokens: {
      type: "string",
    },
  },
});

const client = new AnthropicAI({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

const query = parsed.positionals[0] ?? prompt("Ask me anything: ");
const model = parsed.values.model ?? "claude-3-5-sonnet-20240620";
const max_tokens = parsed.values.maxTokens
  ? Number(parsed.values.maxTokens)
  : 1024;

const _encoder = new TextEncoder();

const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

const stream = client.messages
  .stream({
    messages: [
      {
        role: "user",
        content: query,
      },
    ],
    model,
    max_tokens,
  })
  .on("text", (text) => {
    write(text);
  })
  .on("end", () => {
    write("\n");
  });

const _mes = await stream.finalMessage();
```

Deno の良い点は、 node+npm と違って書き捨てで実行可能な依存を一ファイルで表現できること。

今までは、これをベースにコピペしてカスタマイズしていた。

別に動かないわけではないが、手数が多い。これを書き直す。

## Deno 用共通パーツの解説

Deno の Node 互換層で記述していたので、IO周りを少しだけDeno用に合わせる必要がある。

```ts
// CLI Parser
// node:util で型が付くし、依存を気にせず使える
import { parseArgs } from "node:util";
const parsed = parseArgs({
  args: Deno.args,
  allowPositionals: true,
  options: {},
});

// 標準出力で改行せず stream で書き込む関数
const _encoder = new TextEncoder();
const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

// 入力がなければ標準入出力でプロンプトを表示して入力を受け取る
const input = parsed.positionals[0] ?? prompt("Ask me anything: ");
if (!input) {
  console.error("No prompt");
  Deno.exit(1);
}
```

## AI SDK + AnthropicAI

```ts
import { anthropic } from "npm:@ai-sdk/anthropic@0.0.9";
import { streamText } from "npm:ai@3.4.0";
import { parseArgs } from "node:util";

const parsed = parseArgs({
  args: Deno.args,
  allowPositionals: true,
  options: {},
});

const _encoder = new TextEncoder();
const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

const input = parsed.positionals[0] ?? prompt("Ask me anything: ");
if (!input) {
  console.error("No prompt");
  Deno.exit(1);
}

const { textStream } = await streamText({
  model: anthropic("claude-3-5-sonnet-20240620", {
    // https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic
    // @ts-ignore - anthropic type definitions are not up-to-date
    cacheControl: true,
  }),
  prompt: input,
});

for await (const textPart of textStream) {
  write(textPart);
}
```

## AI SDK + OpenAI

```ts
#!/usr/bin/env -S deno run -A
import { openai } from "npm:@ai-sdk/openai@0.0.61";
import { streamText } from "npm:ai";

const parsed = parseArgs({
  args: Deno.args,
  allowPositionals: true,
  options: {},
});
const _encoder = new TextEncoder();
const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};
const input = parsed.positionals[0] ?? prompt("Ask me anything: ");
if (!input) {
  console.error("No prompt");
  Deno.exit(1);
}

const { textStream } = await streamText({
  model: openai("gpt-4-turbo"),
  prompt: input
});

for await (const textPart of textStream) {
  write(textPart);
}
write("\n");
```

## AI SDK + Gemini

```ts
import { google } from "npm:@ai-sdk/google@0.0.48";
import { streamText } from "npm:ai@3.4.0";
import { parseArgs } from "node:util";

const parsed = parseArgs({
  args: Deno.args,
  allowPositionals: true,
  options: {},
});

const _encoder = new TextEncoder();
const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

const input = parsed.positionals[0] ?? prompt("Ask me anything: ");
if (!input) {
  console.error("No prompt");
  Deno.exit(1);
}

const { textStream } = await streamText({
  model: google("gemini-1.5-pro-latest"),
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: prompt }],
    },
  ],
});

for await (const textPart of textStream) {
  write(textPart);
}
write("\n");
```

## Tools + AnthropicAI

ここから自分にとって本番。

Function Calling(Tools) の応答は結構面倒くさいので、AI SDK で組み合わせてサボる。

```ts
import { anthropic } from "npm:@ai-sdk/anthropic@0.0.50";
import { streamText, tool } from "npm:ai@3.4.0";
import { z } from "npm:zod@3.23.8";
import { parseArgs } from "node:util";

const _encoder = new TextEncoder();
const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

const parsed = parseArgs({
  args: Deno.args,
  allowPositionals: true,
  options: {},
});

const input = parsed.positionals[0] ?? prompt("Ask me anything: ");
if (!input) {
  console.error("No prompt");
  Deno.exit(1);
}
console.log(`%c> ${input}`, "color: gray");

const { textStream } = await streamText({
  model: anthropic("claude-3-5-sonnet-20240620"),
  tools: {
    weather: tool({
      description: "Get the weather in a location",
      // @ts-ignore no types for zod
      parameters: z.object({
        location: z.string().describe("The location to get the weather for"),
      }),
      async execute({ location }) {
        // This is a fake implementation
        return {
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        };
      },
    }),
  },
  onStepFinish(stepResult) {
    if (stepResult.finishReason === "tool-calls") {
      write("\n");
      let printText = "";
      for (const toolCall of stepResult.toolCalls) {
        printText += `[use:${toolCall.toolCallId}] ${
          toolCall.toolName
        }(${JSON.stringify(toolCall.args, null, 2)})\n`;
      }
      for (const toolResult of stepResult.toolResults) {
        printText += `[result:${toolResult.toolCallId}] ${JSON.stringify(
          toolResult.result,
          null,
          2
        )}\n`;
      }
      console.log(`%c${printText}`, "color: gray");
    }
  },
  // toolChoice: "required",
  maxSteps: 5,
  prompt: input,
});

for await (const textPart of textStream) {
  write(textPart);
}
write("\n");
```

実行例

```ts
$ deno run -A vai-claude-tools.ts "Sanfrancisco wheather?"
> Sanfrancisco wheather?
I understand you&#039;re asking about the weather in San Francisco. I can help you with that using the weather tool. However, I noticed a small typo in your request - you wrote "wheather" instead of "weather". No worries, I&#039;ll proceed with getting the weather information for San Francisco.

Let me fetch that information for you:
[use:toolu_01UNzFcBBSCgx7eKueGvH8f9] weather({
  "location": "San Francisco"
})
[result:toolu_01UNzFcBBSCgx7eKueGvH8f9] {
  "location": "San Francisco",
  "temperature": 78
}



Based on the information I received, the current temperature in San Francisco is 78°F (about 26°C).

Is there anything else you&#039;d like to know about the weather in San Francisco or any other location?
```

## Tools + OpenAI

```ts
import { openai } from "npm:@ai-sdk/openai@0.0.61";
import { streamText, tool } from "npm:ai@3.4.0";
import { z } from "npm:zod@3.23.8";
import { parseArgs } from "node:util";
import { ToolCall } from "npm:ai@3.4.0";

const _encoder = new TextEncoder();
const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

const parsed = parseArgs({
  args: Deno.args,
  allowPositionals: true,
  options: {},
});

const input = parsed.positionals[0] ?? prompt("Ask me anything: ");
if (!input) {
  console.error("No prompt");
  Deno.exit(1);
}
console.log(`%c> ${input}`, "color: blue");

const { textStream } = await streamText({
  model: openai("gpt-4-turbo"),
  tools: {
    weather: tool({
      description: "Get the weather in a location",
      // @ts-ignore no types for zod
      parameters: z.object({
        location: z.string().describe("The location to get the weather for"),
      }),
      execute: async ({ location }) => {
        // This is a fake implementation
        return {
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        };
      },
    }),
  },
  onStepFinish(stepResult) {
    if (stepResult.finishReason === "tool-calls") {
      let printText = "";
      for (const toolCall of stepResult.toolCalls) {
        printText += `[use:${toolCall.toolCallId}] ${
          toolCall.toolName
        }(${JSON.stringify(toolCall.args, null, 2)})\n`;
      }
      for (const toolResult of stepResult.toolResults) {
        printText += `[result:${toolResult.toolCallId}] ${JSON.stringify(
          toolResult.result,
          null,
          2
        )}\n`;
      }
      console.log(`%c${printText}`, "color: gray");
    }
  },
  // toolChoice: "required",
  maxSteps: 5,
  prompt: "What is the weather in San Francisco?",
  // prompt: "Write a poem about embedding models.",
});

for await (const textPart of textStream) {
  write(textPart);
}

write("\n");
```

実行例

```bash
$ deno run -A vai-openai-tools.ts "Sanfrancisco wheather?"
[use:call_RHNM66C40SVK7yn0BytrKbqK] weather({
  "location": "San Francisco"
})
[result:call_RHNM66C40SVK7yn0BytrKbqK] {
  "location": "San Francisco",
  "temperature": 65
}

The current temperature in San Francisco is 65°F.
```

実行特性の違いが出て面白い。

## ちょっとだけリファクタ

前提として、この辺のCLIは単一ファイルになってる方が便利だと思ってるので、多少面倒でもハードコードしておくほうがいいと思っている。

その上でコピペ用の共通パーツを切り出しておくならこう。

```ts
import { parseArgs, type ParseArgsConfig } from "node:util";

const _encoder = new TextEncoder();
export const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

export const getOptions = <T extends ParseArgsConfig["options"] | undefined>(
  options: T,
  args: string[] = Deno.args
) => {
  return parseArgs({
    args,
    allowPositionals: true,
    options,
  });
};

// TODO: Get StepResult in ai
type StepResultBase = {
  finishReason: "max-steps" | "tool-calls";
  toolCalls: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  }[];
  toolResults: {
    toolCallId: string;
    result: Record<string, unknown>;
  }[];
};
export function printStepResult<R extends StepResultBase>(stepResult: R) {
  if (stepResult.finishReason === "tool-calls") {
    let printText = "";
    for (const toolCall of stepResult.toolCalls) {
      printText += `[use:${toolCall.toolCallId}] ${
        toolCall.toolName
      }(${JSON.stringify(toolCall.args, null, 2)})\n`;
    }
    for (const toolResult of stepResult.toolResults) {
      printText += `[result:${toolResult.toolCallId}] ${JSON.stringify(
        toolResult.result,
        null,
        2
      )}\n`;
    }
    console.log(`%c${printText}`, "color: gray");
  }
}
```

ai の StepResult 型が取れないので自前で触るプロパティだけ StepResultBase として定義。

これで openai + tools を書き換える。

```ts
import { openai } from "npm:@ai-sdk/openai@0.0.61";
import { streamText, tool } from "npm:ai@3.4.0";
import { z } from "npm:zod@3.23.8";
import { write, getOptions, printStepResult } from "./ai-helpers.ts";

const options = getOptions({});
const input = options.positionals[0] ?? prompt("Ask me anything: ");
if (!input) {
  console.error("No prompt");
  Deno.exit(1);
}
console.log(`%c> ${input}`, "color: blue");

const { textStream } = await streamText({
  model: openai("gpt-4-turbo"),
  tools: {
    weather: tool({
      description: "Get the weather in a location",
      // @ts-ignore no types for zod
      parameters: z.object({
        location: z.string().describe("The location to get the weather for"),
      }),
      execute: async ({ location }) => {
        // This is a fake implementation
        return {
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        };
      },
    }),
  },
  onStepFinish(stepResult) {
    printStepResult(stepResult);
  },
  // toolChoice: "required",
  maxSteps: 5,
  prompt: "What is the weather in San Francisco?",
});

for await (const textPart of textStream) {
  write(textPart);
}

write("\n");
```

あんまり楽にならない。使うのは同じディレクトリに複数タスクを置くときぐらい。

## 追記

作者から fullStream 使うともっと楽になると教えてもらったので Claude + Tools を書き直してみた

[https://twitter.com/lgrammel/status/1837822959668314255](https://twitter.com/lgrammel/status/1837822959668314255)

```ts
import { anthropic } from "npm:@ai-sdk/anthropic@0.0.50";
import { streamText, tool } from "npm:ai@3.4.0";
import { z } from "npm:zod@3.23.8";
import { parseArgs } from "node:util";

const _encoder = new TextEncoder();
const write = (text: string) => {
  Deno.stdout.write(_encoder.encode(text));
};

const parsed = parseArgs({
  args: Deno.args,
  allowPositionals: true,
  options: {},
});

const input = parsed.positionals[0] ?? prompt("Ask me anything: ");
if (!input) {
  console.error("No prompt");
  Deno.exit(1);
}
console.log(`%c> ${input}`, "color: gray");

const { fullStream } = await streamText({
  model: anthropic("claude-3-5-sonnet-20240620"),
  tools: {
    weather: tool({
      description: "Get the weather in a location",
      parameters: z.object({
        location: z.string().describe("The location to get the weather for"),
      }),
      async execute({ location }) {
        // This is a fake implementation
        return {
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        };
      },
    }),
  },
  maxSteps: 5,
  prompt: input,
});

for await (const part of fullStream) {
  switch (part.type) {
    case "text-delta": {
      write(part.textDelta);
      break;
    }
    case "tool-call": {
      console.log(
        `\n%c[tool-call:${part.toolName}] ${JSON.stringify(
          part.args,
          null,
          2
        )}`,
        "color: gray"
      );

      break;
    }

    case "tool-result": {
      console.log(
        `\n%c[tool-result:${part.toolName}] ${JSON.stringify(
          part.result,
          null,
          2
        )}`,
        "color: gray"
      );
      break;
    }

    case "error":
      console.error("Error:", part.error);
      break;
  }
}
write("\n");
```

だいぶ見通しよくなった。

## まとめ

* Vercel AI SDK は Deno CLI でも使えた
* 面倒なストリーム処理やToolsの応答をラップしてくれる
* ツールに特化しない範囲で、コピペ元として用意しておくと便利

### Discussion
![](https://static.zenn.studio/images/drawing/discussion.png)