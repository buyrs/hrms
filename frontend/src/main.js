import { createApp } from "vue"
import App from "./App.vue"
import router from "./router"
import { initSocket } from "./socket"

import {
	Button,
	Input,
	setConfig,
	frappeRequest,
	resourcesPlugin,
	FormControl,
} from "frappe-ui"
import EmptyState from "@/components/EmptyState.vue"

import { IonicVue } from "@ionic/vue"

import { session } from "@/data/session"
import { userResource } from "@/data/user"
import { employeeResource } from "@/data/employee"

import dayjs from "@/utils/dayjs"
import getIonicConfig from "@/utils/ionicConfig"

import FrappePushNotification from "../public/frappe-push-notification"

/* Core CSS required for Ionic components to work properly */
import "@ionic/vue/css/core.css"

/* Theme variables */
import "./theme/variables.css"

import "./main.css"

const app = createApp(App)
const socket = initSocket()

setConfig("resourceFetcher", frappeRequest)
app.use(resourcesPlugin)

app.component("Button", Button)
app.component("Input", Input)
app.component("FormControl", FormControl)
app.component("EmptyState", EmptyState)

app.use(router)
app.use(IonicVue, getIonicConfig())

if (session?.isLoggedIn && !employeeResource?.data) {
	employeeResource.reload()
}

app.provide("$session", session)
app.provide("$user", userResource)
app.provide("$employee", employeeResource)
app.provide("$socket", socket)
app.provide("$dayjs", dayjs)

const registerServiceWorker = () => {
	window.frappePushNotification = new FrappePushNotification("hrms")

	if ("serviceWorker" in navigator) {
		window.frappePushNotification
			.appendConfigToServiceWorkerURL("/assets/hrms/frontend/sw.js")
			.then((url) => {
				navigator.serviceWorker
					.register(url, {
						type: "classic",
					})
					.then((registration) => {
						window.frappePushNotification.initialize(registration).then(() => {
							console.log("Frappe Push Notification initialized")
						})
					})
			})
			.catch((err) => {
				console.error("Failed to register service worker", err)
			})
	} else {
		console.error("Service worker not enabled/supported by browser")
	}
}

router.isReady().then(() => {
	if (import.meta.env.DEV) {
		frappeRequest({
			url: "/api/method/hrms.www.hrms.get_context_for_dev",
		}).then((values) => {
			if (!window.frappe) window.frappe = {}
			window.frappe.boot = values
			registerServiceWorker()
			app.mount("#app")
		})
	} else {
		registerServiceWorker()
		app.mount("#app")
	}
})

router.beforeEach(async (to, from, next) => {
	let isLoggedIn = session.isLoggedIn

	try {
		if (isLoggedIn) await userResource.reload()
	} catch (error) {
		isLoggedIn = false
	}

	if (!isLoggedIn && to.name !== "Login") {
		next({ name: "Login" })
	} else if (isLoggedIn && to.name !== "InvalidEmployee") {
		await employeeResource.promise
		// user should be an employee to access the app
		// since all views are employee specific
		if (
			!employeeResource?.data ||
			employeeResource?.data?.user_id !== userResource.data.name
		) {
			next({ name: "InvalidEmployee" })
		} else if (to.name === "Login") {
			next({ name: "Home" })
		} else {
			next()
		}
	} else {
		next()
	}
})
