import { logger } from '../logger';

export class MessageTools {

  
  async multiAttemptJsonParse(inputString: string, maxAttempts: number = 5): Promise<any> {
    let attempts = 0;

    function aggressiveJsonParse(s: string): any {
      // Convert to string if it's not already
      s = String(s);
      console.log(`s = String(s);: ${s}`);

      // Remove any non-printable characters except newlines
      s = s.replace(/[^\x20-\x7E\n]+/g, '');
      console.log(`s = s.replace(/[^\x20-\x7E\n]+/g, '');: ${s}`);

      // Replace newlines with spaces
      s = s.replace(/\n/g, ' ');
      console.log(`s = s.replace(/\n/g, ' ');: ${s}`);

      // Attempt to fix unquoted keys
      s = s.replace(/(\w+)(?=\s*:)/g, '"$1"');
      console.log(`s = s.replace(/(\\w+)(?=\\s*:)/g, '"$1"');: ${s}`);

      // Attempt to fix single quotes
      s = s.replace(/'/g, '"');
      console.log(`s = s.replace(/'/g, '"');: ${s}`);

      // Attempt to fix missing commas between elements
      s = s.replace(/}\s*{/g, '},{');
      console.log(`s = s.replace(/}\s*{/g, '},{');: ${s}`);
      s = s.replace(/]\s*{/g, '],{');
      console.log(`s = s.replace(/]\\s*{/g, '],{');: ${s}`);
      s = s.replace(/}\s*\[/g, '},[');
      console.log(`s = s.replace(/}\\s*\\[/g, '},[');: ${s}`);
      s = s.replace(/]\s*\[/g, '],[');
      console.log(`      s = s.replace(/]\\s*\\[/g, '],[');: ${s}`);

      // Attempt to fix trailing commas
      s = s.replace(/,\s*}/g, '}');
      s = s.replace(/,\s*]/g, ']');

      // Attempt to fix missing quotes around string values
      s = s.replace(/:\s*([^[{}\],\s]+)/g, ': "$1"');

      // Attempt to fix unbalanced brackets and braces
      const openChars = '[{';
      const closeChars = ']}';
      const charPairs: { [key: string]: string } = { ']': '[', '}': '{' };
      const stack: string[] = [];

      s = s.split('').reduce((acc, char, i) => {
        if (openChars.includes(char)) {
          stack.push(char);
        } else if (closeChars.includes(char)) {
          if (!stack.length || stack[stack.length - 1] !== charPairs[char]) {
            if (!stack.length) {
              acc = charPairs[char] + acc;
            } else {
              acc = acc.slice(0, i) + charPairs[stack[stack.length - 1]] + acc.slice(i);
            }
          } else {
            stack.pop();
          }
        }
        return acc + char;
      }, '');

      // Close any remaining open brackets or braces
      s += stack.reverse().map(char => closeChars[openChars.indexOf(char)]).join('');

      // Final attempt to make it valid JSON
      try {
        return JSON.parse(s);
      } catch (e) {
        console.warn(`Warning: Could not parse JSON. Attempting more aggressive fixes.`);

        // Replace any remaining unquoted values
        s = s.replace(/:\s*([^[{}\],"'\s]+)/g, ': "$1"');

        // Remove any trailing commas in objects and arrays
        s = s.replace(/,\s*([\]}])/g, '$1');

        try {
          return JSON.parse(s);
        } catch (e) {
          logger.error(`Error: Failed to parse JSON. ${(e as Error).message}`);
          return null;
        }
      }
    }


    let result = aggressiveJsonParse(inputString);
    logger.info(JSON.stringify(result, null, 2));
    inputString = inputString.replace('\n', '');
    inputString = inputString.trim();

    while (attempts < maxAttempts && result === null) {
      try {
        switch (attempts) {
          case 0:
            // First attempt: Naive JSON.parse
            result = JSON.parse(inputString);
            break;
          case 1:
            // Second attempt: Aggressive parsing
            result = aggressiveJsonParse(inputString);
            break;
          default:{
            //const prompt = `Fix the following JSON string and return only the corrected JSON:\n${inputString}`;
            // const llmResponse = await orchestrator.handleMessage({command: "sendMessage", role: "system", content: prompt});
            // result = llmResponse ? JSON.parse(llmResponse?.content) : "";
            result = inputString;
            break;
          }
        }
      } catch (error) {
        logger.warn(`Attempt ${attempts + 1} failed: ${(error as Error).message}`);
      }

      attempts++;
    }

    if (result === null) {
      throw new Error("Failed to parse JSON after maximum attempts");
    }

    return result;
  }

  private prepareJsonString(input: string): string {
    // Remove outer quotes
    let cleaned = input.replace(/^"|"$/g, '');
    
    // Replace newlines with escaped newlines
    cleaned = cleaned.replace(/\n/g, '\\n');
    
    // Escape unescaped quotes
    cleaned = cleaned.replace(/(?<!\\)"/g, '\\"');
    
    return cleaned;
  }
}
