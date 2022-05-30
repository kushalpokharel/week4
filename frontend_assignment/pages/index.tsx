import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract, utils } from "ethers"
import Head from "next/head";
import React, { useEffect } from "react"
import styles from "../styles/Home.module.css"
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";
import { useFormik } from 'formik';
import * as yup from 'yup';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
    style: {
        color: "white"
    }
});

const schema = yup.object({
    name: yup
        .string()
        .required()
        .min(3)
        .max(25),

    address: yup
        .string()
        .required(),

    age: yup
        .number()
        .required()
        .positive()
        .integer()
        .min(10)
        .max(90)
});

export default function Home() {

    const classes = useStyles();
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [greetings, setGreetings] = React.useState("");
    useEffect(() => {
        const contract = new Contract(
            '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
            Greeter.abi,
        )

        const provider = new providers.JsonRpcProvider('http://localhost:8545')

        const contractOwner = contract.connect(provider.getSigner())

        contractOwner.on('NewGreeting', (greeting) => {
            const message = utils.parseBytes32String(greeting);
            console.log(message);
            setGreetings(greetings);
        });
    }, []);

    const formik = useFormik({
        initialValues: {
            name: '',
            address: '',
            age: 20,
        },
        validationSchema: schema,
        onSubmit: (values) => {
            alert(JSON.stringify(values, null, 2));
        },
    });

    async function greet(msg: string) {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = msg;

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div>
                    <form onSubmit={formik.handleSubmit}>

                        <TextField
                            inputProps={{ className: classes.style }}
                            InputLabelProps={{ className: classes.style }}
                            margin="normal"
                            fullWidth
                            id="name"
                            name="name"
                            label="Name"
                            value={formik.values.name}
                            onChange={formik.handleChange}
                            error={formik.touched.name && Boolean(formik.errors.name)}
                            helperText={formik.touched.name && formik.errors.name}

                        />
                        <TextField
                            inputProps={{ className: classes.style }}
                            InputLabelProps={{ className: classes.style }}
                            margin="normal"
                            fullWidth
                            id="address"
                            name="address"
                            label="Address"
                            value={formik.values.address}
                            onChange={formik.handleChange}
                            error={formik.touched.address && Boolean(formik.errors.address)}
                            helperText={formik.touched.address && formik.errors.address}

                        />
                        <TextField
                            inputProps={{ className: classes.style }}
                            InputLabelProps={{ className: classes.style }}
                            margin="normal"
                            fullWidth
                            id="age"
                            name="age"
                            label="Age"
                            type="number"
                            value={formik.values.age}
                            onChange={formik.handleChange}
                            error={formik.touched.age && Boolean(formik.errors.age)}
                            helperText={formik.touched.age && formik.errors.age}

                        />
                        <Button color="primary" variant="contained" fullWidth type="submit">
                            Submit
                        </Button>

                        <div onClick={() => greet(formik.values.address)} className={styles.button}>
                            Greet
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
