-- Rework watch_points policies to avoid blocking valid authenticated operator screens
DROP POLICY IF EXISTS "Operators and admins can insert watch points" ON public.watch_points;
DROP POLICY IF EXISTS "Operators and admins can update watch points" ON public.watch_points;
DROP POLICY IF EXISTS "Operators and admins can delete watch points" ON public.watch_points;

CREATE POLICY "Authenticated can insert own watch points"
ON public.watch_points
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners or operators can update watch points"
ON public.watch_points
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'operator'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'operator'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Owners or operators can delete watch points"
ON public.watch_points
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'operator'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);