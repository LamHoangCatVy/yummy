/**
 * ID generators — match Python helpers.
 *   new_session_id() = str(int(time.time() * 1000))
 *   log_id           = int(time.time() * 1000)
 */
export const newSessionId = (): string => String(Date.now());
export const newLogId = (): number => Date.now();
