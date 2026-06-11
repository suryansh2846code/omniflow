export class PromptInjector {
  constructor(client) {
    this.client = client;
  }

  /**
   * Injects prompt text into the active prompt editor.
   * @param {string} promptText 
   */
  async inject(promptText) {
    console.log(`[PromptInjector] Injecting prompt: "${promptText}"`);
    
    // Escape prompt text for injection string
    const escapedText = promptText
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    const result = await this.client.send('Runtime.evaluate', {
      expression: `
        (() => {
          function isVisible(el) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return false;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }

          function findEditor() {
            const slate = document.querySelector('[data-slate-editor="true"]');
            if (slate) return slate;

            const ariaTextbox = document.querySelector('[role="textbox"][contenteditable="true"]');
            if (ariaTextbox) return ariaTextbox;

            const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
            const visibleEditable = editables.find(isVisible);
            if (visibleEditable) return visibleEditable;

            const textareas = Array.from(document.querySelectorAll('textarea'));
            const visibleTextarea = textareas.find(isVisible);
            if (visibleTextarea) return visibleTextarea;

            return null;
          }

          function injectIntoContentEditable(editor, text) {
            editor.focus();
            
            // Try standard execCommand first
            document.execCommand('selectAll');
            const execResult = document.execCommand('insertText', false, text);
            if (execResult) return true;

            // Paste event fallback
            try {
              const dt = new DataTransfer();
              dt.setData('text/plain', text);
              const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true, cancelable: true, clipboardData: dt,
              });
              editor.textContent = '';
              editor.dispatchEvent(pasteEvent);
              editor.dispatchEvent(new InputEvent('input', {
                bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: text,
              }));
            } catch (e) {
              console.warn('Paste strategy error:', e);
            }

            // Direct innerText assignment fallback
            try {
              editor.innerText = text;
              editor.dispatchEvent(new InputEvent('input', {
                bubbles: true, cancelable: true, inputType: 'insertText', data: text,
              }));
              editor.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
              console.warn('Direct assignment strategy error:', e);
            }
          }

          function injectIntoTextarea(editor, text) {
            editor.focus();
            const nativeInputSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 'value'
            )?.set || Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, 'value'
            )?.set;

            if (nativeInputSetter) {
              nativeInputSetter.call(editor, text);
            } else {
              editor.value = text;
            }
            editor.dispatchEvent(new Event('input',  { bubbles: true }));
            editor.dispatchEvent(new Event('change', { bubbles: true }));
          }

          const editor = findEditor();
          if (!editor) {
            return { success: false, error: 'Editor not found' };
          }

          const isContentEditable = editor.getAttribute('contenteditable') === 'true' || editor.isContentEditable;
          if (isContentEditable) {
            injectIntoContentEditable(editor, "${escapedText}");
          } else {
            injectIntoTextarea(editor, "${escapedText}");
          }

          // Read value for verification
          let val = '';
          if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
            val = editor.value;
          } else {
            val = editor.innerText || editor.textContent || '';
          }

          return { success: true, text: val.trim() };
        })()
      `,
      returnByValue: true
    });

    const resVal = result.result.value;
    if (!resVal || !resVal.success) {
      throw new Error(`Prompt injection failed: ${resVal?.error || 'Unknown error'}`);
    }

    console.log(`[PromptInjector] Injected successfully. Verified text: "${resVal.text}"`);
    return true;
  }
}
