ALTER TABLE public.platform_settings 
ADD COLUMN company_latitude double precision DEFAULT NULL,
ADD COLUMN company_longitude double precision DEFAULT NULL,
ADD COLUMN company_address text DEFAULT NULL;