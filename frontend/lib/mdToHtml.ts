/**
 * Minimal Markdown → HTML renderer used throughout the workspace.
 * Handles headings, bold/italic, inline code, fenced code blocks,
 * lists, blockquotes, and paragraphs.
 */
export function mdToHtml(md: string): string {
  if (!md) return ''
  let s = md.trim()

  // Strip wrapping ```markdown or ``` fences that some LLMs add
  if (s.startsWith('```markdown')) s = s.slice(11)
  else if (s.startsWith('```')) s = s.slice(3)
  if (s.endsWith('```')) s = s.slice(0, -3)

  // Extract fenced code blocks first so inner content isn't processed
  const blocks: string[] = []
  s = s.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_: string, lang: string, code: string) => {
    const safe = code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()
    blocks.push(
      `<div style="margin:1rem 0;border-radius:6px;overflow:hidden;border:1px solid var(--border)">` +
      `<div style="background:var(--bg-2);padding:.3rem .8rem;font-size:.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">${lang || 'code'}</div>` +
      `<pre style="padding:1rem;overflow-x:auto;background:var(--bg-1);font-size:.8rem;line-height:1.6"><code>${safe}</code></pre></div>`
    )
    return `__CB${blocks.length - 1}__`
  })

  s = s
    .replace(/^### (.*)/gm, '<h3 style="font-size:1rem;color:var(--text);margin:1rem 0 .4rem;font-family:var(--font-display)">$1</h3>')
    .replace(/^## (.*)/gm, '<h2 style="font-size:1.1rem;color:var(--green);margin:1.2rem 0 .5rem;border-bottom:1px solid var(--border);padding-bottom:.3rem;font-family:var(--font-display)">$1</h2>')
    .replace(/^# (.*)/gm, '<h1 style="font-size:1.3rem;color:var(--green);margin:1.5rem 0 .6rem;font-family:var(--font-display)">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text)">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em style="color:var(--text-2)">$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-2);border:1px solid var(--border);color:var(--amber);padding:.1rem .35rem;border-radius:3px;font-size:.82rem">$1</code>')
    .replace(/^- (.*)/gm, '<li style="margin-left:1.2rem;list-style:disc;margin-bottom:.2rem;color:var(--text)">$1</li>')
    .replace(/^> (.*)/gm, '<blockquote style="border-left:3px solid var(--green-dim);background:var(--green-mute);padding:.5rem 1rem;margin:.5rem 0;border-radius:0 4px 4px 0;color:var(--text-2)">$1</blockquote>')

  s = s.split(/\n\n+/).map((p: string) => {
    const t = p.trim()
    if (!t) return ''
    if (t.startsWith('<') || t.startsWith('__CB')) return t
    if (t.startsWith('<li')) return `<ul style="margin:.4rem 0">${t}</ul>`
    return `<p style="margin-bottom:.6rem;line-height:1.7;color:var(--text);font-size:.85rem">${t.replace(/\n/g, '<br/>')}</p>`
  }).join('\n')

  // Restore code blocks
  s = s.replace(/__CB(\d+)__/g, (_: string, i: string) => blocks[+i])
  return s
}
