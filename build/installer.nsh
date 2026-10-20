!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bienvenido a Batch Video Studio AI"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Suite Profesional de Edición y Procesamiento de Vídeo por Lotes.\r\n\r\n✨ Funcionalidades Principales:\r\n• Procesamiento masivo de vídeo en paralelo con motor FFmpeg\r\n• Visión Multimodal Multi-IA: Google Gemini 3.8 Flash, OpenAI GPT-4o y Claude 3.5 Sonnet\r\n• Detección y recorte automático inteligente de intros, títulos y outros de estudio\r\n• Quick Trim Studio: Editor NLE Multi-Segmento con previsualización en vivo\r\n• Redacción automática de copys y hashtags adaptados para LinkedIn y redes\r\n• Control de marcas de agua dinámicas, relación de aspecto (9:16, 16:9, etc.) y pistas de audio\r\n\r\nHaga clic en Siguiente para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Instalación Completada con Éxito"
  !define MUI_FINISHPAGE_TEXT "Batch Video Studio AI se ha instalado correctamente en su equipo.\r\n\r\nYa puede disfrutar de la máxima velocidad en sus flujos de automatización audiovisual con Inteligencia Artificial."
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
