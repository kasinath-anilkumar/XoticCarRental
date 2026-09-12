export async function saveService(_previous: unknown, form: FormData) {
  document.getElementById("service-saved")!.textContent = JSON.stringify([...form]);
  return { ok: true, message: "Saved in the browser fixture." };
}
