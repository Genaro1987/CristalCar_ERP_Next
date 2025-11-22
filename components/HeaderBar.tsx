type HeaderBarProps = {
  codigoTela: string;
  nomeTela: string;
  caminhoRota?: string;
};

export function HeaderBar({ codigoTela, nomeTela, caminhoRota }: HeaderBarProps) {
  return (
    <header className="header-bar">
      <div>
        <h1 className="header-title">{nomeTela}</h1>
        <div className="header-subtitle">
          {codigoTela}
          {caminhoRota ? ` | ${caminhoRota}` : null}
        </div>
      </div>
    </header>
  );
}
