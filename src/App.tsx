import { useEffect, useRef } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { exampleSetup } from "prosemirror-example-setup";
import { createMachine, assign } from "xstate";
import { useMachine } from "@xstate/react";
import { Plugin } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";


import './App.css'
import './css/container.css'

const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;



const mySchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
  marks: schema.spec.marks
});


const fetchWithRetry = async (url, options, maxRetries = 5) => {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status !== 429) {
        return response;
      }
     
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    } catch (error) {
      throw error;
    }
  }
  throw new Error('API request failed after multiple retries.');
};


const continuationMachine = createMachine({
  id: 'editor',
  initial: 'idle',
  context: {
    error: null,
  },
  states: {
    idle: {
      on: {
        CONTINUE: 'loading',
        CLEAR_ERROR: { actions: assign({ error: null }) }
      },
      entry: assign({ error: null }),
    },
    loading: {
      on: {
        SUCCESS: 'idle',
        FAILURE: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.message || 'An unknown error occurred.',
          }),
        },
      },
    },
    error: {
      on: {
        CONTINUE: 'loading',
      },
    },
  },
});


function App() {
  const [state, send] = useMachine(continuationMachine);
 
  const isLoading = state.matches('loading');

  const editorRef = useRef(null);
  const viewRef = useRef(null);


  useEffect(() => {
    if (viewRef.current) {
      return;
    }

    const contentElement = document.createElement("div");
    contentElement.innerHTML = '<p class="textcolor">Write Here</p>';

    if (editorRef.current) {
      
const view = new EditorView(editorRef.current, {
  state: EditorState.create({
    doc: DOMParser.fromSchema(mySchema).parse(contentElement),
    plugins: [
      ...exampleSetup({ schema: mySchema }),

     
      new Plugin({
        props: {
          handleDOMEvents: {
            focus(view) {
              const firstParagraph = view.state.doc.content.firstChild;

              if (firstParagraph?.textContent === "Write Here") {
                
                view.dom.classList.remove("placeholder");

                
                const tr = view.state.tr;
                tr.delete(1, firstParagraph.nodeSize - 1);
                view.dispatch(tr);

                
                const sel = TextSelection.create(view.state.doc, 1);
                view.dispatch(view.state.tr.setSelection(sel));
              }
              return false;
            }
          }
        }
      }),

      new Plugin({
        props: {
          handleDOMEvents: {
            blur(view) {
              const text = view.state.doc.textContent.trim();

              if (text.length === 0) {
               
                view.dom.classList.add("placeholder");

                
                const tr = view.state.tr;
                tr.insertText("Write Here", 1);
                view.dispatch(tr);
              }
              return false;
            }
          }
        }
      })
    ]
  })
});


view.dom.classList.add("placeholder");





      viewRef.current = view;

      return () => {
        if (viewRef.current) {
          viewRef.current.destroy();
          viewRef.current = null;
        }
      };
    }
  }, []);

  const handleAiWork = async () => {
    if (!viewRef.current || isLoading) return;

    send({ type: 'CONTINUE' });
    // console.log("button clicked")

    try {
      const currentDoc = viewRef.current.state.doc;
      const userText = currentDoc.content.content.map(node => node.textContent).join('\n').trim();

      if (userText.length <11) {
        alert("Please write a bit more before continuing.");
        send({ type: 'FAILURE', message: "Please write a bit more before continuing." });
        return;
      }

      // console.log("User typed:", userText);
      console.log(import.meta.env.VITE_GEMINI_API_KEY)


    
      const systemPrompt = "Continue the user's creative writing naturally and concisely, adding one or two more sentences. Keep the tone and setting exactly the same as the user's input.";

      const payload = {
        contents: [{ parts: [{ text: userText }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      };

      const response = await fetchWithRetry(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error?.message || `API failed with status ${response.status}`);
      }

      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!aiText) {
        throw new Error("AI returned an empty response.");
      }

      console.log("AI Response:", aiText);

     
      const continuationText = aiText.trim();

      const newTransaction = viewRef.current.state.tr;
      const docSize = viewRef.current.state.doc.content.size;

      const lastNode = viewRef.current.state.doc.lastChild;
      if (lastNode && lastNode.type.name === 'paragraph') {
        const pos = docSize - 1;
        newTransaction.insertText(` ${continuationText}`, pos);
      } else {
        newTransaction.insert(docSize, mySchema.node("paragraph", null, mySchema.text(continuationText)));
      }

      viewRef.current.dispatch(newTransaction);

      send('SUCCESS');

    } catch (err) {
      console.error("AI Continue Error:", err);
      send({ type: 'FAILURE', message: `Failed to continue text: ${err.message}` });
    }
  };

  return (
    <>


      <div className="">
        <div className="">


          <header className="">
            <div className="logo">
              Aieditor
            </div>

          </header>

          <main className="main">
            <div className="mb-4">


              <div
                ref={editorRef}
                className="container"

              >

                <button
                  className="cbutton"
                  onClick={handleAiWork}
                  disabled={isLoading}
                >


                  {isLoading ? 'AI Writing...' : 'Continue Writing'}
                </button>
              </div>

              <div id="content" className="hidden"></div>
            </div>



          </main>
        </div>
      </div>
    </>
  );
}

export default App;