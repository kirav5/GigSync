/** The phone's own model (ADR 0040): the chat's offer, its download, and Settings once it is kept. */
export const model = {
  "model.title": "Your agent's model",
  "model.offer": "Help your agent understand you better: download about {mb} MB to this phone.",
  "model.offer_download": "Download",
  "model.offer_later": "Later",
  "model.mobile_data": "You are on mobile data: this uses about {mb} MB of it.",
  "model.wifi_best": "Best on Wi-Fi.",
  "model.private": "It runs on this phone only: what you type never leaves it.",
  "model.downloading": "Downloading the model to this phone: {percent}% ({done} of {mb} MB)",
  "model.paused": "The model download stopped part-way. It carries on from where it was.",
  "model.resume": "Resume download",
  "model.ready_line": "Your agent now runs on this phone, even offline",
  "model.kept_line": "This phone's own model · about {mb} MB · {state}",
  "model.state_ready": "Ready",
  "model.state_downloading": "Downloading {percent}%",
  "model.remove": "Remove from this phone",
} as const;
