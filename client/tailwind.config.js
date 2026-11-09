module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #2563eb)',
        'primary-light': 'var(--color-primary-light, #3b82f6)',
        secondary: 'var(--color-secondary, #0f172a)',
        highlight: 'var(--color-highlight, #f59e0b)',
        accent: 'var(--color-accent, #10b981)',
        surface: 'var(--color-surface, #ffffff)',
        'surface-solid': 'var(--color-surface-solid, #ffffff)',
        paper: 'var(--color-paper, #f8fafc)',
        'paper-solid': 'var(--color-paper-solid, #f8fafc)',
        line: 'var(--color-line, #e2e8f0)',
        ink: 'var(--color-ink, #0f172a)',
        'ink-soft': 'var(--color-ink-soft, #64748b)',
        navy: 'var(--color-navy, #122338)',
      },
      borderRadius: {
        card: 'var(--card-radius, 1.25rem)',
        btn: 'var(--button-radius, 0.75rem)',
      },
    },
  },
  plugins: [],
};
