/** One validation problem, addressed by a JSON path (e.g. `options[2].text`). */
export interface FieldError {
  path: string;
  code: string;
  message: string;
}
