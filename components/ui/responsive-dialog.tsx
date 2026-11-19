'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Dialog as BaseDialog,
  DialogContent as BaseDialogContent,
  DialogHeader as BaseDialogHeader,
  DialogTitle as BaseDialogTitle,
  DialogDescription as BaseDialogDescription,
  DialogFooter as BaseDialogFooter,
  DialogClose as BaseDialogClose,
} from '@/components/ui/dialog';
import {
  Drawer as BaseDrawer,
  DrawerContent as BaseDrawerContent,
  DrawerHeader as BaseDrawerHeader,
  DrawerTitle as BaseDrawerTitle,
  DrawerDescription as BaseDrawerDescription,
  DrawerFooter as BaseDrawerFooter,
  DrawerClose as BaseDrawerClose,
} from '@/components/ui/drawer';

interface ResponsiveDialogContextValue {
  isMobile: boolean;
}

const ResponsiveDialogContext = React.createContext<ResponsiveDialogContextValue>({
  isMobile: false,
});

export interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  modal?: boolean;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  defaultOpen,
  modal,
  ...props
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile: true }}>
        <BaseDrawer open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen} modal={modal} {...props}>
          {children}
        </BaseDrawer>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile: false }}>
      <BaseDialog open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen} modal={modal} {...props}>
        {children}
      </BaseDialog>
    </ResponsiveDialogContext.Provider>
  );
}

function useIsMobile() {
  return React.useContext(ResponsiveDialogContext).isMobile;
}

export const ResponsiveDialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseDialogContent> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BaseDrawerContent
        ref={ref}
        className={cn(
          'max-h-[88vh] overflow-y-auto rounded-t-2xl border-t bg-background px-5 pb-6 pt-2',
          className
        )}
        {...props}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30, delay: 0.06 }}
          className="flex flex-col gap-4"
        >
          {children}
        </motion.div>
      </BaseDrawerContent>
    );
  }

  return (
    <BaseDialogContent ref={ref} className={className} {...props}>
      {children}
    </BaseDialogContent>
  );
});
ResponsiveDialogContent.displayName = 'ResponsiveDialogContent';

export const ResponsiveDialogHeader = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialogHeader>) => {
  const isMobile = useIsMobile();
  const Comp = isMobile ? BaseDrawerHeader : BaseDialogHeader;
  return <Comp className={cn(className)} {...props} />;
};
ResponsiveDialogHeader.displayName = 'ResponsiveDialogHeader';

export const ResponsiveDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof BaseDialogTitle>
>(({ className, ...props }, ref) => {
  const isMobile = useIsMobile();
  const Comp = isMobile ? BaseDrawerTitle : BaseDialogTitle;
  return <Comp ref={ref} className={cn(className)} {...props} />;
});
ResponsiveDialogTitle.displayName = 'ResponsiveDialogTitle';

export const ResponsiveDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof BaseDialogDescription>
>(({ className, ...props }, ref) => {
  const isMobile = useIsMobile();
  const Comp = isMobile ? BaseDrawerDescription : BaseDialogDescription;
  return <Comp ref={ref} className={cn(className)} {...props} />;
});
ResponsiveDialogDescription.displayName = 'ResponsiveDialogDescription';

export const ResponsiveDialogFooter = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialogFooter>) => {
  const isMobile = useIsMobile();
  const Comp = isMobile ? BaseDrawerFooter : BaseDialogFooter;
  return <Comp className={cn(className)} {...props} />;
};
ResponsiveDialogFooter.displayName = 'ResponsiveDialogFooter';

export const ResponsiveDialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseDialogClose>
>(({ className, ...props }, ref) => {
  const isMobile = useIsMobile();
  const Comp = isMobile ? BaseDrawerClose : BaseDialogClose;
  return <Comp ref={ref} className={cn(className)} {...props} />;
});
ResponsiveDialogClose.displayName = 'ResponsiveDialogClose';

// Aliases so existing call sites keep working without renaming.
export const Dialog = ResponsiveDialog;
export const DialogContent = ResponsiveDialogContent;
export const DialogHeader = ResponsiveDialogHeader;
export const DialogTitle = ResponsiveDialogTitle;
export const DialogDescription = ResponsiveDialogDescription;
export const DialogFooter = ResponsiveDialogFooter;
export const DialogClose = ResponsiveDialogClose;
