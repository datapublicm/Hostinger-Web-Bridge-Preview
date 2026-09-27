# Original UI Remote Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mantener exactamente las pantallas originales de Archivos, Python y Consola, usando Bridge directo cuando esté disponible y GitHub Remote cuando exista una sesión Supabase/GitHub activa.

**Architecture:** Las rutas visibles `/files/`, `/python/` y `/terminal/` no cambian. Cada módulo detecta primero una sesión GitHub Remote; si existe usa `RemoteAPI`, y si no existe conserva el backend Bridge actual. `/remote/` queda como puerta de autenticación, no como reemplazo visual de los módulos.

**Tech Stack:** GitHub Pages, JavaScript vanilla, Supabase Auth/Edge Functions, GitHub Actions, FastAPI Bridge.

**Spec:** Diseño original ya aprobado en las pantallas existentes del repositorio público.

## Global Constraints

- No cambiar layout, colores, tipografías, tablas, editor, consola ni sidebar existentes.
- Casa conserva Bridge directo/ngrok.
- Oficina usa GitHub Remote sin exponer PAT, SSH keys ni secretos al navegador.
- La raíz de archivos sigue siendo `/srv/DiscoD`; Python trabaja bajo `/srv/DiscoD/Python`.

## Review Focus

- Sesión Remote activa con Bridge bloqueado debe seguir mostrando los módulos originales.
- Sin sesión Remote, el comportamiento Bridge actual debe permanecer intacto.
- Navegación de carpetas debe conservar rutas relativas y no salir de `/srv/DiscoD`.
- Python debe poder explorar carpetas, abrir/guardar `.py` y ejecutarlos desde `/srv/DiscoD/Python`.
- Consola Remote debe conservar el panel negro y ejecutar comandos independientes mediante `terminal-exec`.

---

### Task 1: Contratos de interfaz dual
**Files:** Modify `tests/test_remote_ui_contract.py`.
- [ ] Añadir tests que exijan que `/files/`, `/python/` y `/terminal/` carguen configuración Remote sin alterar su HTML visual.
- [ ] Verificar RED.

### Task 2: Archivos con UI original
**Files:** Modify `files/index.html`, `files/public-loader.js`; Create `files/remote-app.js`.
- [ ] Detectar sesión Remote antes de intentar cargar el módulo privado Bridge.
- [ ] Implementar listar, abrir carpetas, crear carpeta/archivo, renombrar, mover y eliminar usando `RemoteAPI` y los mismos selectores/tabla existentes.
- [ ] Mantener Bridge privado como fallback cuando no hay sesión Remote.
- [ ] Verificar tests.

### Task 3: Python con explorador y ejecución
**Files:** Modify `python/index.html`, `python/app.js`.
- [ ] Detectar sesión Remote.
- [ ] En modo Remote explorar `/srv/DiscoD/Python`, navegar carpetas y filtrar por nombre desde Buscar scripts.
- [ ] Abrir/guardar `.py` con `read-text`/`write-text` y ejecutar archivo con `python-run-file`; mantener ejecución de código suelto con `python-run`.
- [ ] Conservar el editor y panel de salida originales.
- [ ] Verificar tests.

### Task 4: Consola negra con backend Remote
**Files:** Modify `terminal/index.html`, `terminal/app.js`.
- [ ] Detectar sesión Remote.
- [ ] Habilitar el input original y ejecutar `terminal-exec`, mostrando comando/salida en el mismo panel negro.
- [ ] Conservar Bridge directo cuando no hay sesión Remote.
- [ ] Verificar tests.

### Task 5: Navegación y login
**Files:** Modify `portal/app.js`, `portal/index.html`, `remote/app.js`.
- [ ] Restaurar enlaces normales `/files/`, `/python/`, `/terminal/` en el portal.
- [ ] Tras autenticar GitHub Remote, volver al portal; los módulos decidirán el backend automáticamente.
- [ ] Ejecutar la suite completa y desplegar solo tras verde.
