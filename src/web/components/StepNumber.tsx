/** The round number in front of a cooking step. */
export function StepNumber({ index }: { index: number }) {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: 24,
        height: 24,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--violet)',
        background: 'color-mix(in srgb, var(--violet) 16%, transparent)',
      }}
    >
      {index + 1}
    </span>
  );
}
