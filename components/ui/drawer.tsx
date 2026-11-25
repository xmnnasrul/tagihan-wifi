'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';

import { cn } from '@/lib/utils';

const CLOSE_VELOCITY = 900;
const BACKDROP_DIM_DISTANCE = 240;
const SHEET_SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.6 } as const;

interface DrawerContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DrawerContext = React.createContext<DrawerContextValue>({
  open: false,
  setOpen: () => {},
});

const Drawer = ({
  open,
  onOpenChange,
  defaultOpen,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DrawerContext.Provider value={{ open: isOpen, setOpen }}>
      <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DrawerContext.Provider>
  );
};
Drawer.displayName = 'Drawer';

const DrawerClose = DialogPrimitive.Close;

const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(DrawerContext);
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const sheetRef = React.useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const animationRef = React.useRef<{ stop: () => void } | null>(null);
  const draggedRef = React.useRef(false);
  const [sheetHeight, setSheetHeight] = React.useState(0);
  const backdropOpacity = useTransform(dragY, [0, BACKDROP_DIM_DISTANCE], [1, 0.2]);

  const setSheetNode = React.useCallback((node: HTMLDivElement | null) => {
    sheetRef.current = node;
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (!node) return;
    const updateHeight = () => setSheetHeight(node.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    resizeObserverRef.current = observer;
  }, []);

  React.useEffect(() => {
    if (!open) return;
    animationRef.current?.stop();
    animationRef.current = null;
    draggedRef.current = false;
    dragY.set(0);
    return () => {
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, [open, dragY]);

  const close = React.useCallback(() => setOpen(false), [setOpen]);

  return (
    <AnimatePresence onExitComplete={() => dragY.set(0)}>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
            >
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 bg-black/60"
                style={{ opacity: backdropOpacity }}
              />
            </motion.div>
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild forceMount ref={ref} {...props}>
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50"
              initial={prefersReducedMotion ? false : { y: '100%' }}
              animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { y: '100%', transition: { duration: 0.2, ease: 'easeIn' } }
              }
              transition={prefersReducedMotion ? { duration: 0 } : SHEET_SPRING}
            >
              <motion.div
                ref={setSheetNode}
                className={cn(
                  'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-border/70 bg-background shadow-2xl',
                  className
                )}
                style={prefersReducedMotion ? undefined : { y: dragY }}
                drag={prefersReducedMotion ? false : 'y'}
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: sheetHeight || 1 }}
                dragElastic={0.06}
                dragMomentum={false}
                onDragStart={() => {
                  draggedRef.current = false;
                  animationRef.current?.stop();
                  animationRef.current = null;
                }}
                onDrag={(_event, info) => {
                  if (Math.abs(info.offset.y) > 4 || Math.abs(info.offset.x) > 4) {
                    draggedRef.current = true;
                  }
                }}
                onDragEnd={(_event, info) => {
                  if (info.velocity.y > CLOSE_VELOCITY) {
                    close();
                    return;
                  }
                  animationRef.current = animate(dragY, 0, SHEET_SPRING);
                }}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Geser atau tutup panel"
                  className="group flex h-11 w-full shrink-0 cursor-grab touch-none select-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing"
                  onPointerDown={(event) => {
                    if (prefersReducedMotion) return;
                    draggedRef.current = false;
                    dragControls.start(event);
                  }}
                  onClick={() => {
                    if (draggedRef.current) {
                      draggedRef.current = false;
                      return;
                    }
                    close();
                  }}
                >
                  <span className="h-1.5 w-12 rounded-full bg-muted-foreground/40 transition-[background-color,transform] duration-150 group-hover:bg-muted-foreground/60 group-active:scale-105 group-active:bg-muted-foreground/70" />
                </button>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {children}
                </div>
              </motion.div>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
});
DrawerContent.displayName = 'DrawerContent';

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('grid gap-1.5 p-4 text-center md:text-left', className)}
    {...props}
  />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('mt-auto flex flex-col gap-2 p-4', className)}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
DrawerTitle.displayName = DialogPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DrawerDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
