export function createSubmitGate() {
  let submitting = false;

  function tryStart(): boolean {
    if (submitting) return false;
    submitting = true;
    return true;
  }

  function finish() {
    submitting = false;
  }

  function isSubmitting(): boolean {
    return submitting;
  }

  return { tryStart, finish, isSubmitting };
}
