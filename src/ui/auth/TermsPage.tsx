import type { ReactNode } from 'react';

const lastUpdated = '3 de agosto de 2026';
const siteDomain = 'starcraft-builder.com';

function TermsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="terms-page__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function TermsPage() {
  return (
    <div className="terms-page">
      <main className="terms-page__main">
        <a className="terms-page__logo-link" href="/" aria-label="Volver al inicio">
          <img className="terms-page__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} />
        </a>
        <article className="panel terms-page__article">
          <header className="terms-page__header">
            <p className="eyebrow">Información legal</p>
            <h1>Términos y condiciones de uso</h1>
            <p className="muted">Última actualización: {lastUpdated}</p>
          </header>

          <div className="terms-page__content">
            <TermsSection title="1. Titularidad y aceptación">
              <p>
                El titular del servicio se identifica únicamente mediante el dominio <strong>{siteDomain}</strong>.
                No se publican datos personales del titular en esta página.
              </p>
              <p>
                Al crear una cuenta o utilizar la aplicación aceptas estos términos. Si no estás de acuerdo,
                no debes registrarte ni utilizar el servicio.
              </p>
            </TermsSection>

            <TermsSection title="2. Cuenta y acceso">
              <p>
                El acceso a la aplicación requiere una cuenta. Debes proporcionar una dirección de correo válida,
                mantener tus credenciales seguras y facilitar información veraz. Eres responsable de la actividad
                realizada con tu cuenta y debes avisar si detectas un uso no autorizado.
              </p>
              <p>
                Podemos solicitar la verificación del correo electrónico y limitar temporalmente el acceso cuando
                sea necesario para proteger el servicio o a sus usuarios.
              </p>
            </TermsSection>

            <TermsSection title="3. Uso de las listas">
              <p>
                La aplicación permite crear, guardar y gestionar listas para uso personal. Cuando una lista se marca
                como pública, otros usuarios pueden verla y clonarla en su propia cuenta, pero no editar la lista
                original. El propietario conserva el control sobre su contenido y su visibilidad.
              </p>
              <p>
                No debes utilizar el servicio para introducir contenido ilegal, malicioso, engañoso o que infrinja
                derechos de terceros, ni para intentar acceder a cuentas o datos ajenos.
              </p>
            </TermsSection>

            <TermsSection title="4. Propiedad intelectual">
              <p>
                StarCraft, sus nombres, imágenes y elementos relacionados pertenecen a sus respectivos titulares.
                Esta aplicación es un proyecto fanmade no oficial y no implica afiliación, patrocinio ni autorización
                por parte de Blizzard Entertainment o de otros titulares.
              </p>
              <p>
                El contenido que aportes debe respetar los derechos aplicables. Al publicar una lista autorizas su
                almacenamiento y, si la haces pública, su consulta y clonación dentro de la aplicación.
              </p>
            </TermsSection>

            <TermsSection title="5. Disponibilidad y cambios">
              <p>
                El servicio se ofrece tal como está disponible. Podemos realizar mantenimiento, introducir cambios
                o retirar funciones para mantenerlo seguro y operativo. También podremos actualizar estos términos;
                la versión publicada en esta página será la aplicable desde su fecha de actualización.
              </p>
            </TermsSection>

            <TermsSection title="6. Contacto">
              <p>
                Para cualquier consulta relacionada con estos términos, utiliza los canales de contacto disponibles
                en <strong>{siteDomain}</strong>.
              </p>
            </TermsSection>
          </div>

          <footer className="terms-page__footer">
            <a href="/">Volver al acceso</a>
          </footer>
        </article>
      </main>
    </div>
  );
}
