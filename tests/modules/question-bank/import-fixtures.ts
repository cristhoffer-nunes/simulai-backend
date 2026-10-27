export const goodItem = (overrides: Record<string, unknown> = {}) => ({
  type: 'multiple_choice',
  statement: 'Qual câmara recebe o sangue oxigenado das veias pulmonares?',
  subject: 'Anatomia',
  topic: 'Sistema cardiovascular',
  difficulty: 'easy',
  options: [
    { id: 'A', text: 'Átrio direito' },
    { id: 'B', text: 'Átrio esquerdo' },
    { id: 'C', text: 'Ventrículo direito' },
    { id: 'D', text: 'Aorta' },
  ],
  correctOptionId: 'B',
  explanation: 'As veias pulmonares desembocam no átrio esquerdo.',
  ...overrides,
});
