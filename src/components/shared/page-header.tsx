
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string | ReactNode;
  children?: ReactNode; 
  className?: string; 
}

export default function PageHeader({ title, description, children, className: classNameProp }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 md:mb-8", classNameProp)}>
      <div className={cn(
        "flex flex-col sm:items-center gap-4", 
        children 
          ? "sm:flex-row sm:justify-between"
          : "sm:text-center" 
      )}>
        <div> {/* This div holds the title and description */}
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-md text-muted-foreground">
              {typeof description === 'string' ? description : description}
            </p>
          )}
        </div>
        {children && <div className="flex-shrink-0">{children}</div>} {/* Action buttons */}
      </div>
    </div>
  );
}
