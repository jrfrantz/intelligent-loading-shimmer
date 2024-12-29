import { parse } from "@babel/parser";
import traverse from "@babel/traverse"
import OpenAI from "openai";
import fs = require("fs");
import path from "path";
import { startComment } from "./consts";


export async function generateLoadingFile(fullPath: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  // read file to string
  const fileContent = fs.readFileSync(fullPath, 'utf8');

  // ask the AI to generate a loading screen based on 
  // the file content
  console.log(`Creating loading screen for ${fullPath}`)
  const response = await openai.chat.completions.create({
    model: 'chatgpt-4o-latest',
    messages: [
      { 
        role: "system", 
        content: "You are a helpful coding assistent that generates fully functional, totally static and self-contained React + Typescript components for use in a Next.js project with the app router. As input, you are passed a `page.tsx` file, which is async and fetches some dynamic content before rendering it. In response, you give the react component for a corresponding `loading.tsx` file that matches the look-and-feel of the dynamic `page.tsx` file. Since these are loading components, they're totally static -- making no use of useEffect, data fetching, or anything like that. Just a nice loading skeleton shimmer. Do all styling with inline CSS, so that your output file is self-contained. Output the contents of `loading.tsx` with no other exposition, since your response will be written directly to `loading.tsx` verbatim. What follows is `page.tsx`:" 
      },
      { 
        role: "user", 
        content: `${fileContent}`},
    ],
  })
  console.log(`Generated loading screen for ${fullPath}`)
  
  const ast = parse(fileContent, {
    sourceType: "module",
    plugins: ["typescript", "jsx" ],
  });

  const localImports: string[] = [];
  // check if the default export is an async function
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration;
      if (declaration.type === "FunctionDeclaration") {
        const isAsync = declaration.async;
        if (isAsync) {
          console.log("default export is async function %s", declaration.id?.name);
        }
      }
    },
    ImportDeclaration(path) {
      const source = path.node.source.value;
      console.log({ source })
      // check if the import is a local import
      // of a react component
      localImports.push(source);
    },
  });


  const fileOutputAi = response.choices[0]?.message.content ?? ""
  const fileOutput = fileOutputAi.replace(/```tsx/g, "").replace(/```/g, "")

  // TODO ensure it is valid react code and retry or bail otherwise

  const prefix = startComment+
`// This file will stay up-to-date when you make changes to your \`page.tsx\` file
// and run \`next-loading-cli\` again.
// You can edit this file. To prevent future overwrites, delete the comment line.
`

  const loadingFileLocation = path.join(process.cwd(), "app", "loading.tsx")
  fs.writeFileSync(loadingFileLocation, prefix + fileOutput)
  console.log(`Wrote loading screen to ${loadingFileLocation}`)
}