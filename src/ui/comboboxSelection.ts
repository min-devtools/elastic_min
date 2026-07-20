export function comboboxEnterValue(value: string, highlighted: string, interacted: boolean): string {
  return interacted ? highlighted : value;
}
