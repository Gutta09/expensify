import { cn } from '../../lib/utils';

interface IosSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
}

const sizeMap = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function IosSpinner({ size = 'md', className, color }: IosSpinnerProps) {
  const bladeCount = 12;
  const sizeClass = sizeMap[size];

  return (
    <div className={cn('relative', sizeClass, className)} role="status" aria-label="Loading">
      {Array.from({ length: bladeCount }).map((_, i) => (
        <div
          key={i}
          className="ios-spinner-blade"
          style={{
            transform: `rotate(${i * 30}deg)`,
            animationDelay: `${(-1 + i * (1 / bladeCount)).toFixed(2)}s`,
            ...(color ? { backgroundColor: color } : {}),
          }}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default IosSpinner;
