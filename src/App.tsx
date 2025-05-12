import {
  createEffect,
  createSignal,
  For,
  onMount,
  type Signal,
} from "solid-js";
import { basicSetup, EditorView } from "codemirror";

import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";

import "baboolastyles/public/plastic.css";

function App() {
  let ifr!: HTMLIFrameElement;

  let fileInp!: HTMLInputElement;

  const cssCode = createSignal("");

  const htmlCode = createSignal("");

  const jsCode = createSignal("");

  const codeErrors = createSignal<string[]>([]);

  const htmlEditorVis = createSignal(true);

  const cssEditorVis = createSignal(true);

  const jsEditorVis = createSignal(true);

  const errorsVis = createSignal(true);

  const projName = createSignal("");

  onMount(() => {
    setupEditors();
    createEffect(() => {
      codeErrors[1]([]);
      try {
        new Function(jsCode[0]());
      } catch (e) {
        codeErrors[1]((v) => {
          v.push(
            (e as any).name +
              ": " +
              ((e as any).message === "Unexpected token }" ||
              (e as any).message === "Unexpected token '}'"
                ? "Likely a standalone keyword, function with no implementation, or incorrectly closed braces."
                : (e as any).message)
          );
          return [...v];
        });
      }
      const output = `
      <!DOCTYPE html>
      <html>
      <head>
      <title>Webpage</title>
      <style>
      ${cssCode[0]()}
      </style>
      </head>
      <body>
      ${htmlCode[0]()}
      <script>
       window.onerror=(e)=>{
parent.postMessage({type: 'codeError', error: e}, "*")
     }
 
      ${jsCode[0]()}
     
        
      <\/script>
      </body>
      </html>
      `;
      ifr.srcdoc = output;
    });

    window.addEventListener("message", (e) => {
      if (e.data.type === "codeError") {
        codeErrors[1]((v) => {
          v.push(e.data.error.toString());
          return [...v];
        });
      }
    });
  });

  function setupEditors() {
    createEditor({
      valueSignal: jsCode,
      editorElement: document.querySelector(".js-editor")!,
      extension: javascript(),
    });

    createEditor({
      valueSignal: htmlCode,
      editorElement: document.querySelector(".html-editor")!,
      extension: html(),
    });

    createEditor({
      valueSignal: cssCode,
      editorElement: document.querySelector(".css-editor")!,
      extension: css(),
    });
  }

  return (
    <>
      <div class="toolbar">
        <button
          onClick={() => {
            downloadHTML(
              (projName[0]() || "Webpage") + ".htm",
              ifr.contentWindow!.document.documentElement.outerHTML
            );
          }}
        >
          <span>Save</span>
        </button>
        <input
          accept=".htm; .html"
          onChange={(e) => {
            if (!e.target.files?.length) return;
            const f = e.target.files[0];
            const fr = new FileReader();

            fr.onload = (e) => {
              const parsed = extractHTMLCSSJS(e.target!.result as string);
              cssCode[1](parsed.styles);
              htmlCode[1](parsed.bodyContents);
              jsCode[1](parsed.scripts);
              projName[1](getFileNameWithoutExtension(f.name));
              setupEditors();
            };

            fr.readAsText(f);
          }}
          type="file"
          hidden
          ref={fileInp}
        />
        <button
          onClick={() => {
            fileInp.click();
          }}
        >
          <span>Open file</span>
        </button>
        <input
          value={projName[0]()}
          onInput={(e) => {
            projName[1](e.target.value);
          }}
          placeholder="Project name"
        />
      </div>
      <div class="main">
        <div class="editors">
          <div>
            <h3
              class="section-header"
              onClick={() => {
                htmlEditorVis[1]((v) => !v);
              }}
            >
              HTML
            </h3>
            <div
              classList={{
                hidden: !htmlEditorVis[0](),
              }}
              class="html-editor editor"
            ></div>
          </div>

          <div>
            <h3
              class="section-header"
              onClick={() => {
                cssEditorVis[1]((v) => !v);
              }}
            >
              CSS
            </h3>
            <div
              classList={{
                hidden: !cssEditorVis[0](),
              }}
              class="css-editor editor"
            ></div>
          </div>

          <div>
            <h3
              class="section-header"
              onClick={() => {
                jsEditorVis[1]((v) => !v);
              }}
            >
              JS
            </h3>
            <div
              classList={{
                hidden: !jsEditorVis[0](),
              }}
              class="js-editor editor"
            ></div>
          </div>
        </div>
        <div class="rightside">
          <iframe
            ref={ifr}
            allow="microphone; camera; autoplay; display-capture; clipboard-write"
          ></iframe>
          <div class="errors">
            <h3
              class="section-header"
              onClick={() => {
                errorsVis[1]((v) => !v);
              }}
            >
              ERRORS
            </h3>
            <div class="errors-main" classList={{ hidden: !errorsVis[0]() }}>
              <For each={codeErrors[0]()}>
                {(err) => {
                  return <div class="error">{err}</div>;
                }}
              </For>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  function createEditor(props: {
    valueSignal: Signal<string>;
    editorElement: Element;
    extension:
      | ReturnType<typeof javascript>
      | ReturnType<typeof html>
      | ReturnType<typeof css>;
  }) {
    props.editorElement.innerHTML = "";
    const editor = new EditorView({
      doc: props.valueSignal[0](),
      extensions: [
        props.extension,
        EditorView.lineWrapping,
        basicSetup,
        EditorView.updateListener.of(() => {
          props.valueSignal[1](editor.state.doc.toString());
        }),
      ],
      parent: props.editorElement,
    });

    return editor;
  }
}

function downloadHTML(filename: string, content: string) {
  const element = document.createElement("a");
  const blob = new Blob([content], { type: "text/html" });
  element.href = URL.createObjectURL(blob);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
function getFileNameWithoutExtension(fileName: string) {
  return fileName.split(".").slice(0, -1).join(".");
}
function extractHTMLCSSJS(htmlString: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  // Extract contents of style tags
  const styleContents = Array.from(doc.querySelectorAll("style"))
    .map((style) => style.innerHTML)
    .join("\n");

  // Extract contents of script tags that contain inline scripts (not src)
  const scriptContents = Array.from(doc.querySelectorAll("script:not([src])"))
    .map((script) => script.innerHTML)
    .join("\n");

  // Extract everything inside body that is not a script, style, or head
  const body = doc.body.cloneNode(true);
  //@ts-ignore
  body.querySelectorAll("script, style").forEach((el) => el.remove());
  //@ts-ignore
  const bodyContents = body.innerHTML.trim();

  return {
    styles: styleContents,
    scripts: scriptContents,
    bodyContents: bodyContents,
  };
}

export default App;
