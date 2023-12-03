import type { Intent } from '@conform-to/react';
import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { parse, refine } from '@conform-to/zod';
import type { ActionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';
import { z } from 'zod';

// Instead of sharing a schema, prepare a schema creator
function createSchema(
	intents: Array<Intent> | null,
	constraint: {
		// isUsernameUnique is only defined on the server
		isUsernameUnique?: (username: string) => Promise<boolean>;
	} = {},
) {
	return z
		.object({
			username: z
				.string({ required_error: 'Username is required' })
				.regex(
					/^[a-zA-Z0-9]+$/,
					'Invalid username: only letters or numbers are allowed',
				)
				// Pipe the schema so it runs only if the username is valid
				.pipe(
					z.string().superRefine((username, ctx) =>
						refine(ctx, {
							validate: () => constraint.isUsernameUnique?.(username),
							when:
								!intents ||
								intents.some(
									(intent) =>
										intent.type === 'validate' && intent.payload === 'username',
								),
							message: 'Username is already used',
						}),
					),
				),
		})
		.and(
			z
				.object({
					password: z.string({ required_error: 'Password is required' }),
					confirmPassword: z.string({
						required_error: 'Confirm password is required',
					}),
				})
				.refine((data) => data.password === data.confirmPassword, {
					message: 'Password does not match',
					path: ['confirmPassword'],
				}),
		);
}

export async function action({ request }: ActionArgs) {
	const formData = await request.formData();
	const submission = await parse(formData, {
		schema: (intent) =>
			// create the zod schema with the intent and constraint
			createSchema(intent, {
				isUsernameUnique(username) {
					return new Promise((resolve) => {
						setTimeout(() => {
							resolve(username !== 'admin');
						}, Math.random() * 300);
					});
				},
			}),
		async: true,
	});

	if (!submission.value) {
		return json(submission.reject());
	}

	return redirect(`/?value=${JSON.stringify(submission.value)}`);
}

export default function Signup() {
	const lastResult = useActionData<typeof action>();
	const { meta, fields } = useForm({
		lastResult,
		onValidate({ formData }) {
			return parse(formData, {
				// Create the schema without any constraint defined
				schema: (intents) => createSchema(intents),
			});
		},
		shouldValidate: 'onBlur',
	});

	return (
		<Form method="post" {...getFormProps(meta)}>
			<label>
				<div>Username</div>
				<input
					className={!fields.username.valid ? 'error' : ''}
					{...getInputProps(fields.username)}
				/>
				<div>{fields.username.error}</div>
			</label>
			<label>
				<div>Password</div>
				<input
					className={!fields.password.valid ? 'error' : ''}
					{...getInputProps(fields.password, { type: 'password' })}
				/>
				<div>{fields.password.error}</div>
			</label>
			<label>
				<div>Confirm Password</div>
				<input
					className={!fields.confirmPassword.valid ? 'error' : ''}
					{...getInputProps(fields.confirmPassword, { type: 'password' })}
				/>
				<div>{fields.confirmPassword.error}</div>
			</label>
			<hr />
			<button>Signup</button>
		</Form>
	);
}
