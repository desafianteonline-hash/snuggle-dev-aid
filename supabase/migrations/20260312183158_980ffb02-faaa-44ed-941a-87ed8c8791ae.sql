
CREATE POLICY "Operators can update patrollers"
ON public.patrollers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'operator'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'operator'::app_role));
