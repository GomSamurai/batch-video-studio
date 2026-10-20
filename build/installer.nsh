!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bienvenido a Batch Video Studio AI"
  !define MUI_WELCOMEPAGE_TEXT "Suite profesional de edición y procesamiento masivo de vídeo con IA.$\r$\n$\r$\nFuncionalidades destacadas:$\r$\n• Procesamiento masivo de vídeo en paralelo con motor FFmpeg.$\r$\n• Visión Multimodal con Inteligencia Artificial (Gemini, GPT-4o y Claude).$\r$\n• Detección y recorte automático de intros y outros de estudio.$\r$\n• Quick Trim Studio: Editor NLE multi-segmento con previsualización.$\r$\n• Redacción automática de copys y hashtags optimizados para redes.$\r$\n$\r$\nHaga clic en Siguiente para continuar con la instalación."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Instalación Completada con Éxito"
  !define MUI_FINISHPAGE_TEXT "Batch Video Studio AI se ha instalado correctamente en su equipo.$\r$\n$\r$\nYa puede disfrutar de la máxima velocidad en sus flujos de edición y automatización audiovisual con Inteligencia Artificial."
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartAppCustom
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartAppCustom"
  !endif
  !insertmacro MUI_PAGE_FINISH
!macroend
