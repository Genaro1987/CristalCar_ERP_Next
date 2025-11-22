"use client";

export type HelpData = {
  CODIGO_TELA: string;
  NOME_TELA: string;
  OBJETIVO_TELA?: string | null;
  QUANDO_UTILIZAR?: string | null;
  DESCRICAO_PROCESSO?: string | null;
  PASSO_A_PASSO?: string | null;
  CAMPOS_OBRIGATORIOS?: string | null;
  CAMPOS_OPCIONAIS?: string | null;
  REFLEXOS_PROCESSO?: string | null;
  ERROS_COMUNS?: string | null;
};

function HelpSection(props: { titulo: string; texto?: string | null }) {
  if (!props.texto) return null;
  return (
    <div className="help-section">
      <div className="help-section-title">{props.titulo}</div>
      <p className="help-section-body">{props.texto}</p>
    </div>
  );
}

export function HelpPanel({
  helpData,
  onClose,
  loading,
}: {
  helpData: HelpData | null;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <aside className="help-panel">
      <div className="help-panel-content">
        <button type="button" className="help-panel-close" onClick={onClose}>
          ×
        </button>

        {loading && <p>Carregando ajuda...</p>}

        {!loading && helpData && (
          <>
            <h2 className="help-title">{helpData.NOME_TELA}</h2>
            <p className="help-code">{helpData.CODIGO_TELA}</p>
            <HelpSection titulo="Objetivo" texto={helpData.OBJETIVO_TELA} />
            <HelpSection titulo="Quando utilizar" texto={helpData.QUANDO_UTILIZAR} />
            <HelpSection titulo="Descricao" texto={helpData.DESCRICAO_PROCESSO} />
            <HelpSection titulo="Passo a passo" texto={helpData.PASSO_A_PASSO} />
            <HelpSection
              titulo="Campos obrigatorios"
              texto={helpData.CAMPOS_OBRIGATORIOS}
            />
            <HelpSection titulo="Campos opcionais" texto={helpData.CAMPOS_OPCIONAIS} />
            <HelpSection
              titulo="Reflexos no processo"
              texto={helpData.REFLEXOS_PROCESSO}
            />
            <HelpSection titulo="Erros comuns" texto={helpData.ERROS_COMUNS} />
          </>
        )}

        {!loading && !helpData && <p>Ajuda ainda nao configurada para esta tela.</p>}
      </div>
    </aside>
  );
}
