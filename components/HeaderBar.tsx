type HeaderBarProps = {
  codigoTela: string;
  nomeTela: string;
  caminhoRota?: string;
};

export function HeaderBar({ codigoTela, nomeTela, caminhoRota }: HeaderBarProps) {
  return (
    <header className="header-bar">
      <div className="header-bar-title">
        <h1>{nomeTela}</h1>
        <div className="header-bar-meta">
          <span>{codigoTela}</span>
          {caminhoRota && <span> | {caminhoRota}</span>}
        </div>
      </div>
      {/* Espaço reservado para pesquisa e icone de ajuda em tarefas futuras */}
    </header>
  );
}
