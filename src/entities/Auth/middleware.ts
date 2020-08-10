import { Request } from 'express'
import { Authenticator, AuthLinkType, AuthIdentity, AuthChain, parseEmphemeralPayload } from 'dcl-crypto'
import { fromBase64 } from '../../utils/base64'
import { HttpProvider } from 'web3x/providers'
import RequestError from '../Route/error'
import { middleware } from '../Route/handle'

export type WithAuth<R extends Request = Request> = R & {
  auth: string | null
}

export type AuthOptions = {
  optional?: boolean,
  allowInvalid?: boolean
}

export function auth(options: AuthOptions = {}) {
  return middleware(async (req) => {
    const authorization = req.header('authorization')
    if (!authorization && options.optional) {
      return
    } else if (!authorization) {
      throw new RequestError(`Unauthorized`, RequestError.Unauthorized)
    }

    const [type, token] = authorization.split(' ')
    if (type.toLowerCase() !== 'bearer' && options.allowInvalid) {
      return
    } else if (type.toLowerCase() !== 'bearer') {
      throw new RequestError(`Invalid authorization type: "${type}"`, RequestError.Unauthorized)
    }

    // let identity: AuthIdentity
    let ephemeralAddress: string
    let authChain: AuthChain
    try {
      const data = fromBase64(token)
      const identity = JSON.parse(data) as AuthIdentity | AuthChain
      authChain = Array.isArray(identity) ? identity : identity.authChain
      const ephemeralPayloadLink = authChain.find(link => [AuthLinkType.ECDSA_PERSONAL_EPHEMERAL, AuthLinkType.ECDSA_EIP_1654_EPHEMERAL].includes(link.type))
      const ephemeralPayload = parseEmphemeralPayload(ephemeralPayloadLink && ephemeralPayloadLink.payload || '')
      ephemeralAddress = ephemeralPayload.ephemeralAddress
    } catch (error) {
      console.log(error)
      if (options.allowInvalid) {
        return
      } else {
        throw new RequestError(`Invalid authorization token`, RequestError.Unauthorized)
      }
    }

    let result: { ok: boolean, message?: string } = { ok: false }
    try {
      result = await Authenticator.validateSignature(
        ephemeralAddress,
        authChain,
        new HttpProvider('https://mainnet.infura.io/v3/640777fe168f4b0091c93726b4f0463a')
      )
    } catch (error) {
      console.error(error)
      if (options.allowInvalid) {
        return
      } else {
        throw new RequestError(`Invalid authorization token sign`, RequestError.Unauthorized)
      }
    }

    if (!result.ok && options.allowInvalid) {
      return
    } else if (!result.ok) {
      throw new RequestError(result.message || 'Invalid authorization data', RequestError.Forbidden)
    }

    const auth = Authenticator.ownerAddress(authChain).toLowerCase()
    Object.assign(req, { auth })
  })
}
