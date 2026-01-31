import {z} from 'zod'

export const sendVerificationSchema = z.object({
      email: z.email()
    })

export type SendVerification = z.infer<sendVerificationSchema>

export const checkEmailValidationSchema = z.object({
    email: z.string(),
    verifyCode: z.string()
})

export type CheckEmailValidation = z.infer<checkEmailValidationSchema>