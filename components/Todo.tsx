// Champ à renseigner avant la mise en ligne : surligné pour qu'on ne le manque pas.
export default function Todo({ children }: { children: string }) {
  return <strong className="todo">[À COMPLÉTER : {children}]</strong>;
}
