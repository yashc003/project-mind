import * as fs from 'fs/promises';
import * as path from 'path';
import type { GraphNode, GraphEdge, SemanticEntity } from '../../types/index.js';

const RATIONALE_REGEX = /(?:\/\/|\/\*|#)\s*(NOTE|WHY):\s*(.+?)(?=\n|$|\*\/)/gi;
const MAX_RATIONALE_LENGTH = 500;

export async function extractRationale(projectPath: string, files: string[]): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  // Safe extensions to prevent parsing minified assets or binaries
  const safeExtensions = ['.ts', '.js', '.py', '.go', '.java', '.c', '.cpp', '.cs', '.rs', '.php', '.rb'];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!safeExtensions.includes(ext)) continue;

    try {
      const fullPath = path.join(projectPath, file);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      let match;
      let count = 0;
      // Reset regex state just in case
      RATIONALE_REGEX.lastIndex = 0;
      
      while ((match = RATIONALE_REGEX.exec(content)) !== null) {
        count++;
        // match[1] is NOTE or WHY, match[2] is the text
        const typeStr = match[1].toUpperCase();
        let text = match[2].trim();
        
        if (text.length > MAX_RATIONALE_LENGTH) {
          text = text.substring(0, MAX_RATIONALE_LENGTH) + '...';
        }
        
        const nodeId = `rationale_${file}_${count}`;
        
        nodes.push({
          id: nodeId,
          type: 'rationale',
          label: `[${typeStr}] ${text.length > 30 ? text.substring(0, 30) + '...' : text}`,
          properties: {
            fullText: text,
            sourceFile: file,
            rationaleType: typeStr
          }
        });
        
        edges.push({
          source: nodeId,
          target: `file_${file}`,
          relation: 'RATIONALE_FOR',
          provenance: 'EXTRACTED',
          confidence: 1.0
        });
      }
    } catch (err) {
      // Ignore files that can't be read (e.g. deleted since last scan)
    }
  }

  return { nodes, edges };
}
